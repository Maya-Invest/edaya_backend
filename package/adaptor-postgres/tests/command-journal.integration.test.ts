import type { CommandReceiptScope } from '@edaya/core'
import { CommandExecution, runDurableWorkBatch } from '@edaya/service'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { runMigrations } from '../src/lib/migrate'
import { PostgresAtomicExecution, transactionContext } from '../src/lib/transaction'
import { PostgresCommandJournal } from '../src/stores/command-journal-store'
import { PostgresDurableWork } from '../src/stores/durable-work-store'

const scope: CommandReceiptScope = { schoolId: 'school-a', command: 'fixture', callerId: 'identity:a', requestId: 'request' }

async function fixture(run: (context: { db: PGlite, execution: CommandExecution, journal: PostgresCommandJournal }) => Promise<void>) {
  const db = new PGlite()
  try {
    const connection = drizzle(db)
    await runMigrations(connection, { driver: 'pglite' })
    const journal = new PostgresCommandJournal()
    await run({ db, journal, execution: new CommandExecution(new PostgresAtomicExecution(connection), journal) })
  }
  finally { await db.close() }
}

test('durable replay reauthorizes the caller and resource, rejects changed input and isolates namespaces', async () => {
  await fixture(async ({ db, execution }) => {
    let effects = 0
    let authorizations = 0
    let allowed = true
    const command = (callerScope = scope, input = { amount: 12 }) => execution.execute({
      scope: callerScope,
      input,
      resultMode: 'ordinary',
      authorize: async () => {
        authorizations++
        if (!allowed)
          throw new Error('revoked')
      },
      execute: async () => ({ id: `effect-${++effects}` }),
      persistResult: result => result,
      replay: async result => result,
      audit: result => [{ event: 'fixture.completed', resourceType: 'fixture', resourceId: result.id }],
    })
    expect(await command()).toEqual({ id: 'effect-1' })
    expect(await command()).toEqual({ id: 'effect-1' })
    expect(effects).toBe(1)
    expect(authorizations).toBe(2)
    await expect(command(scope, { amount: 13 })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
    allowed = false
    await expect(command()).rejects.toThrow('revoked')
    allowed = true
    expect(await command({ ...scope, callerId: 'identity:b' })).toEqual({ id: 'effect-2' })
    expect(await command({ ...scope, schoolId: 'school-b' })).toEqual({ id: 'effect-3' })
    expect(await command({ ...scope, command: 'other' })).toEqual({ id: 'effect-4' })
    expect((await db.query('SELECT * FROM command_receipts')).rows).toHaveLength(4)
    expect((await db.query('SELECT * FROM command_audit')).rows).toHaveLength(4)
  })
}, 30000)

test('secret-display persists only the explicit safe projection and replay checks current linkage', async () => {
  await fixture(async ({ db, execution }) => {
    let linked = true
    const command = () => execution.execute<{ id: string, secret?: string }, { id: string }>({
      scope,
      input: { request: 'new' },
      resultMode: 'secret-display',
      authorize: async () => {},
      execute: async () => ({ id: 'grant', secret: 'ONE-TIME-CREDENTIAL' }),
      persistResult: result => ({ id: result.id }),
      replay: async (result) => {
        if (!linked)
          throw new Error('unlinked')
        return result
      },
      audit: result => [{ event: 'grant.issued', resourceType: 'grant', resourceId: result.id }],
      outbox: result => [{ id: 'expiry', kind: 'grant.expiry', version: 1, resourceType: 'grant', resourceId: result.id }],
    })
    expect(await command()).toEqual({ id: 'grant', secret: 'ONE-TIME-CREDENTIAL' })
    expect(await command()).toEqual({ id: 'grant' })
    for (const table of ['command_receipts', 'command_audit', 'command_outbox'])
      expect(JSON.stringify((await db.query(`SELECT * FROM ${table}`)).rows)).not.toContain('ONE-TIME-CREDENTIAL')
    linked = false
    await expect(command()).rejects.toThrow('unlinked')
  })
})

test('outbox failure rolls back business writes, receipt and audit using the same transaction', async () => {
  await fixture(async ({ db, execution, journal }) => {
    await db.exec('CREATE TABLE fixture_effects (id text PRIMARY KEY)')
    const command = (badOutbox: boolean) => execution.execute({
      scope,
      input: {},
      resultMode: 'ordinary',
      authorize: async () => {},
      execute: async () => {
        const tx = transactionContext.getStore() as ReturnType<typeof drizzle>
        await tx.execute(sql`INSERT INTO fixture_effects VALUES ('effect')`)
        return { id: 'effect' }
      },
      persistResult: result => result,
      replay: async result => result,
      audit: result => [{ event: 'fixture.completed', resourceType: 'fixture', resourceId: result.id }],
      outbox: result => [{ id: 'work', kind: 'fixture', version: badOutbox ? 0 : 1, resourceType: 'fixture', resourceId: result.id }],
    })
    await expect(command(true)).rejects.toThrow()
    for (const table of ['fixture_effects', 'command_receipts', 'command_audit', 'command_outbox'])
      expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0)
    expect(await command(false)).toEqual({ id: 'effect' })
    expect((await db.query('SELECT * FROM command_outbox')).rows).toHaveLength(1)
    await expect(journal.find(scope)).rejects.toThrow('active business transaction')
  })
})

test('durable batch retries only unfinished work and persists stable errors without provider payloads', async () => {
  await fixture(async ({ db, execution }) => {
    const store = new PostgresDurableWork(drizzle(db))
    for (const id of ['success', 'retry', 'old-version']) {
      await execution.execute({
        scope: { ...scope, requestId: id },
        input: {},
        resultMode: 'ordinary',
        authorize: async () => {},
        execute: async () => ({ id }),
        persistResult: result => result,
        replay: async result => result,
        audit: result => [{ event: 'fixture.created', resourceType: 'fixture', resourceId: result.id }],
        outbox: result => [{ id, kind: 'fixture', version: id === 'old-version' ? 2 : 1, resourceType: 'fixture', resourceId: result.id }],
      })
    }
    const calls: string[] = []
    let fail = true
    const handlers = {
      fixture: {
        version: 1,
        run: async (work: { id: string }) => {
          expect(transactionContext.getStore()).toBeUndefined()
          calls.push(work.id)
          if (fail && work.id === 'retry')
            throw new Error('Provider failure: private token=DO-NOT-PERSIST')
        },
      },
    }
    expect(await runDurableWorkBatch(store, handlers)).toEqual({ completed: 1, failed: 2, lostLease: 0 })
    expect((await db.query('SELECT id, status, failure_code FROM command_outbox ORDER BY id')).rows).toEqual([
      { id: 'old-version', status: 'dead', failure_code: 'WORK_VERSION_UNSUPPORTED' },
      { id: 'retry', status: 'failed', failure_code: 'WORK_HANDLER_FAILED' },
      { id: 'success', status: 'completed', failure_code: null },
    ])
    expect(await runDurableWorkBatch(store, handlers)).toEqual({ completed: 0, failed: 0, lostLease: 0 })
    fail = false
    await db.exec('UPDATE command_outbox SET next_attempt_at = now() - INTERVAL \'1 second\' WHERE id = \'retry\'')
    expect(await runDurableWorkBatch(store, handlers)).toEqual({ completed: 1, failed: 0, lostLease: 0 })
    expect(calls.sort()).toEqual(['retry', 'retry', 'success'])
    expect(JSON.stringify((await db.query('SELECT * FROM command_outbox')).rows)).not.toContain('DO-NOT-PERSIST')
    const atomic = new PostgresAtomicExecution(drizzle(db))
    await expect(atomic.execute(() => store.claim({ kinds: ['fixture'], limit: 1, leaseMs: 1000 }))).rejects.toThrow('outside business transactions')
  })
})
