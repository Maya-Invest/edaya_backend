import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { AtomicExecutionPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresDurableWork, runMigrations, transactionContext } from '@edaya/adaptor-postgres'
import { noOpFileStorage, noOpNotificationGateway } from '@edaya/core'
import { executeCronOccurrence, SchoolApplication, tickCronSchedules } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'
import { createFixtureRepositories } from '../utils/fixture-repositories'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')
interface SqlExecutor { execute: (statement: SQL) => Promise<{ rows: unknown[] }> }
const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
const query = (statement: string) => (handles[0]!.db as SqlExecutor).execute(sql.raw(statement))
let rollbackAfterEffects = false
const applications = handles.map((handle) => {
  const atomic = new PostgresAtomicExecution(handle.db as PostgresTransactionalDb)
  // A persisted probe in the same transaction demonstrates both duplicate
  // suppression and rollback of effects when completion cannot commit.
  const probedAtomic: AtomicExecutionPort = {
    execute: (operation, options) => atomic.execute(async () => {
      if (!options?.lockKeys) {
        await (transactionContext.getStore() as SqlExecutor).execute(sql`INSERT INTO cron_fixture_effects DEFAULT VALUES`)
      }
      const result = await operation()
      if (!options?.lockKeys && rollbackAfterEffects)
        throw new Error('injected commit failure')
      return result
    }, options),
  }
  const repositories = createFixtureRepositories(handle.db)
  return new SchoolApplication({ repositories, atomicExecution: probedAtomic, commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(handle.db as SqlExecutor), fileStorage: noOpFileStorage, notificationGateway: noOpNotificationGateway })
})
const messages: { jobId: string }[] = []
function tick(index: number, dispatch = async (message: { jobId: string }) => {
  // This borrows the same pool's only connection. Dispatch inside the business
  // transaction would deadlock instead of completing this test.
  await (handles[index]!.db as SqlExecutor).execute(sql`SELECT 1`)
  messages.push(message)
}) {
  return tickCronSchedules({
    application: applications[index]!,
    dispatcher: { dispatch },
    computeNextRunAt: () => new Date('2026-09-14T12:05:00Z'),
  }, { asOf: new Date('2026-09-14T12:00:00Z'), requestIdPrefix: crypto.randomUUID() })
}

beforeAll(async () => {
  await runMigrations(handles[0]!.db, { driver: 'node-postgres' })
  await query(`CREATE TABLE cron_fixture_effects (id bigserial PRIMARY KEY);
    DELETE FROM cron_job_schedules;
    INSERT INTO schools (id, name, short_name, time_zone, created_at) VALUES
      ('cron-native-a', 'Cron A', 'Cron A', 'UTC', now()), ('cron-native-b', 'Cron B', 'Cron B', 'UTC', now());
    INSERT INTO message_deliveries (id, school_id, subject_id, title, body, event_key, status, created_at, updated_at)
      SELECT 'cron-test-' || id, id, 'test-subject', 'Title', 'Body', 'test.event', 'pending', now(), now()
      FROM schools WHERE id IN ('cron-native-a','cron-native-b');
    INSERT INTO cron_job_schedules (id, job_key, cron_expression, enabled, next_run_at, created_at, updated_at)
    VALUES ('cron-native', 'reconcilePendingDeliveries', '*/5 * * * *', true, '2026-09-14T12:00:00Z', now(), now())`)
})
afterAll(async () => {
  await Promise.all(handles.map(handle => handle.dispose()))
})

test('competing pool-size-one heartbeats commit one occurrence per school before sending', async () => {
  await Promise.all(Array.from({ length: 6 }, (_, index) => tick(index % 2)))
  expect((await query('SELECT * FROM cron_occurrences WHERE schedule_id = \'cron-native\'')).rows).toHaveLength(2)
  expect((await query('SELECT * FROM command_receipts WHERE command = \'cron.occurrence\'')).rows).toHaveLength(2)
  expect((await query('SELECT * FROM command_outbox WHERE kind IN (\'cron.dispatch\', \'cron.execute\')')).rows).toHaveLength(4)
  expect(messages).toHaveLength(2)
}, 10000)

test('a committed occurrence runs once across duplicate queue deliveries and independent pools', async () => {
  const jobId = messages[0]!.jobId
  await Promise.all(Array.from({ length: 6 }, (_, index) => executeCronOccurrence(applications[index % 2]!, jobId)))
  expect(await executeCronOccurrence(applications[0]!, jobId)).toBe('ack')
  // Outer occurrence transaction and existing job transaction each record a
  // probe; duplicates must not create any further business transaction.
  expect((await query('SELECT * FROM cron_fixture_effects')).rows).toHaveLength(2)
  expect(await applications[0]!.durableWork.getState(jobId)).toMatchObject({ status: 'completed' })
}, 10000)

test('failure after handler completion rolls back effects and completion, then another instance recovers', async () => {
  const jobId = messages[1]!.jobId
  rollbackAfterEffects = true
  try {
    expect(await executeCronOccurrence(applications[0]!, jobId)).toBe('retry')
  }
  finally { rollbackAfterEffects = false }
  expect((await query('SELECT * FROM cron_fixture_effects')).rows).toHaveLength(2)
  expect(await applications[0]!.durableWork.getState(jobId)).toMatchObject({ status: 'failed' })
  await (handles[0]!.db as SqlExecutor).execute(sql`UPDATE command_outbox SET next_attempt_at = clock_timestamp() - INTERVAL '1 second' WHERE id = ${jobId}`)
  expect(await executeCronOccurrence(applications[1]!, jobId)).toBe('ack')
  expect((await query('SELECT * FROM cron_fixture_effects')).rows).toHaveLength(4)
}, 10000)
