import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { SQL } from 'drizzle-orm'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresDurableWork, runMigrations, transactionContext } from '@edaya/adaptor-postgres'
import { CommandExecution } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')

const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
const executions = handles.map(handle => new CommandExecution(new PostgresAtomicExecution(handle.db as PostgresTransactionalDb), new PostgresCommandJournal()))
const scope = { schoolId: 'journal-school', command: 'journal-fixture', callerId: 'identity:journal-subject', requestId: 'race' }
interface SqlExecutor { execute: (statement: SQL) => Promise<{ rows: unknown[] }> }
const query = (statement: string) => (handles[0]!.db as SqlExecutor).execute(sql.raw(statement))

beforeAll(async () => {
  await runMigrations(handles[0]!.db, { driver: 'node-postgres' })
  await query('CREATE TABLE journal_fixture_effects (id text PRIMARY KEY, amount integer NOT NULL)')
})
afterAll(async () => {
  await Promise.all(handles.map(handle => handle.dispose()))
})

function command(instance: number, requestId: string, options: { amount?: number, fail?: boolean, kind?: string, authorize?: () => Promise<void> } = {}) {
  const amount = options.amount ?? 5
  return executions[instance]!.execute({
    // Real request contexts may contain trace metadata. It is not part of
    // persistent receipt identity and must not split the serialization lock.
    scope: Object.assign({ ...scope, requestId }, { traceId: crypto.randomUUID() }),
    input: { amount },
    resultMode: 'ordinary',
    authorize: options.authorize ?? (async () => {}),
    execute: async () => {
      const tx = transactionContext.getStore() as SqlExecutor
      const id = crypto.randomUUID()
      await tx.execute(sql`INSERT INTO journal_fixture_effects (id, amount) VALUES (${id}, ${amount})`)
      return { id, amount }
    },
    persistResult: result => result,
    replay: async result => result,
    audit: result => [{ event: 'fixture.completed', resourceType: 'fixture', resourceId: result.id }],
    outbox: result => [{ id: result.id, kind: options.kind ?? 'fixture', version: options.fail ? 0 : 1, resourceType: 'fixture', resourceId: result.id }],
  })
}

test('competing API instances with pool size one commit one effect, receipt, audit and outbox', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => command(index % 2, 'race')))
  expect(new Set(results.map(result => result.id)).size).toBe(1)
  expect((await query('SELECT * FROM journal_fixture_effects')).rows).toHaveLength(1)
  expect((await query('SELECT * FROM command_receipts WHERE school_id = \'journal-school\'')).rows).toHaveLength(1)
  expect((await query('SELECT * FROM command_audit WHERE school_id = \'journal-school\'')).rows).toHaveLength(1)
  expect((await query('SELECT * FROM command_outbox WHERE school_id = \'journal-school\'')).rows).toHaveLength(1)
  expect(await command(1, 'race')).toEqual(results[0]!)
  await expect(command(1, 'race', { amount: 6 })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
  await expect(command(1, 'race', {
    authorize: async () => {
      throw new Error('current access revoked')
    },
  })).rejects.toThrow('current access revoked')
}, 10000)

test('two workers claim once; expired leases recover and stale or foreign-school completion is rejected', async () => {
  const stores = handles.map(handle => new PostgresDurableWork(handle.db as SqlExecutor))
  await command(0, 'durable-lease', { kind: 'lease-fixture' })
  const claim = { kinds: ['lease-fixture'], limit: 1, leaseMs: 60000 }
  const claims = (await Promise.all(stores.map(store => store.claim(claim)))).flat()
  expect(claims).toHaveLength(1)
  const original = claims[0]!
  expect(original.attempts).toBe(1)
  expect(await stores[0]!.complete({ ...original, schoolId: 'foreign-school' })).toBe(false)
  expect(await stores[0]!.renew(original, 60000)).toBe(true)
  await (handles[0]!.db as SqlExecutor).execute(sql`UPDATE command_outbox SET lease_expires_at = clock_timestamp() - INTERVAL '1 second' WHERE id = ${original.id}`)
  expect(await stores[0]!.renew(original, 60000)).toBe(false)
  const [recovered] = await stores[1]!.claim(claim)
  expect(recovered!.attempts).toBe(2)
  expect(recovered!.leaseId).not.toBe(original.leaseId)
  expect(await stores[0]!.complete(original)).toBe(false)
  expect(await stores[1]!.complete(recovered!)).toBe(true)
  expect(await stores[0]!.claim(claim)).toEqual([])
}, 10000)

test('failed work backs off; a crash on the last attempt becomes terminal without another effect', async () => {
  const store = new PostgresDurableWork(handles[0]!.db as SqlExecutor)
  await command(0, 'durable-budget', { kind: 'budget-fixture' })
  const claim = { kinds: ['budget-fixture'], limit: 1, leaseMs: 60000 }
  const [work] = await store.claim(claim)
  expect(await store.fail(work!, { code: 'PROVIDER_UNAVAILABLE', permanent: false })).toBe(true)
  expect(await store.claim(claim)).toEqual([])
  await (handles[0]!.db as SqlExecutor).execute(sql`UPDATE command_outbox SET next_attempt_at = clock_timestamp() - INTERVAL '1 second' WHERE id = ${work!.id}`)
  const [retried] = await store.claim(claim)
  expect(retried!.attempts).toBe(2)
  await (handles[0]!.db as SqlExecutor).execute(sql`UPDATE command_outbox SET attempts = 8, lease_expires_at = clock_timestamp() - INTERVAL '1 second' WHERE id = ${work!.id}`)
  expect(await store.claim(claim)).toEqual([])
  const rows = await (handles[0]!.db as SqlExecutor).execute(sql`SELECT status, failure_code FROM command_outbox WHERE id = ${work!.id}`)
  expect(rows.rows).toEqual([{ status: 'dead', failure_code: 'WORK_ATTEMPTS_EXHAUSTED' }])
}, 10000)

test('an outbox error rolls everything back and the same request can safely retry', async () => {
  const before = (await query('SELECT * FROM journal_fixture_effects')).rows.length
  await expect(command(0, 'rollback', { fail: true })).rejects.toThrow()
  expect((await query('SELECT * FROM journal_fixture_effects')).rows).toHaveLength(before)
  expect((await query('SELECT * FROM command_receipts WHERE school_id = \'journal-school\' AND request_id = \'rollback\'')).rows).toHaveLength(0)
  const result = await command(1, 'rollback')
  expect(await command(0, 'rollback')).toEqual(result)
  expect((await query('SELECT * FROM journal_fixture_effects')).rows).toHaveLength(before + 1)
}, 10000)
