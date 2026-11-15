import type { CronJobDispatchMessage } from '@edaya/service'
import { noOpFileStorage, noOpNotificationGateway } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { expect, onTestFinished, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../adaptor-postgres/src/stores/command-journal-store'
import { PostgresDurableWork } from '../../../adaptor-postgres/src/stores/durable-work-store'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'
import { executeCronOccurrence } from '../../src/capabilities/scheduling-jobs/durable-cron'
import { tickCronSchedules } from '../../src/capabilities/scheduling-jobs/tick-cron-schedules'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

async function fixture() {
  const fixture = await createAuthorizationDatabase()
  onTestFinished(() => releaseDatabase(fixture.db))
  const application = new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(fixture.connection), fileStorage: noOpFileStorage, notificationGateway: noOpNotificationGateway })
  await fixture.db.exec(`DELETE FROM cron_job_schedules;
    INSERT INTO message_deliveries (id, school_id, subject_id, title, body, event_key, status, created_at, updated_at)
      SELECT 'cron-test-' || id, id, 'test-subject', 'Title', 'Body', 'test.event', 'pending', now(), now()
      FROM schools WHERE id IN ('school-a','school-b');
    INSERT INTO cron_job_schedules (id, job_key, cron_expression, enabled, next_run_at, created_at, updated_at)
    VALUES ('fixture', 'reconcilePendingDeliveries', '*/5 * * * *', true, '2026-07-03T12:00:00Z', now(), now())`)
  const messages: CronJobDispatchMessage[] = []
  const tick = (dispatch = async (message: CronJobDispatchMessage) => {
    messages.push(message)
  }) => tickCronSchedules({
    application,
    dispatcher: { dispatch },
    computeNextRunAt: () => new Date('2026-07-03T12:05:00Z'),
  }, { asOf: new Date('2026-07-03T12:00:00Z'), requestIdPrefix: crypto.randomUUID() })
  return { ...fixture, application, messages, tick }
}

test('idle schedules advance without creating queue or journal records', async () => {
  const { tick, db, messages, application } = await fixture()
  await db.exec('UPDATE message_deliveries SET status = \'read\'')
  await tick()
  for (const table of ['cron_occurrences', 'command_receipts', 'command_audit', 'command_outbox'])
    expect((await db.query(`SELECT * FROM ${table}`)).rows).toEqual([])
  expect(messages).toEqual([])
  expect((await application.repositories.cronJobSchedules.findById('fixture'))?.lastDispatchedAt).toBeNull()
  expect((await application.repositories.cronJobSchedules.findById('fixture'))?.nextRunAt.toISOString()).toBe('2026-07-03T12:05:00.000Z')
}, 30000)

test('heartbeats persist school-bound occurrences and advance schedules before transport; replay executes once', async () => {
  const { tick, application, db, messages } = await fixture()
  await tick(async (message) => {
    expect((await application.repositories.cronJobSchedules.findById('fixture'))?.nextRunAt.toISOString()).toBe('2026-07-03T12:05:00.000Z')
    messages.push(message)
  })
  expect(messages).toHaveLength(2)
  expect(Object.keys(messages[0]!)).toEqual(['jobId'])
  expect((await db.query('SELECT school_id FROM cron_occurrences ORDER BY school_id')).rows).toEqual([{ school_id: 'school-a' }, { school_id: 'school-b' }])
  expect((await db.query('SELECT * FROM command_receipts')).rows).toHaveLength(2)
  expect((await db.query('SELECT * FROM command_audit')).rows).toHaveLength(2)
  expect((await tick()).dispatches).toEqual([])
  for (const message of messages) {
    expect(await executeCronOccurrence(application, message.jobId)).toBe('ack')
    expect(await executeCronOccurrence(application, message.jobId)).toBe('ack')
  }
  expect((await db.query('SELECT attempts FROM command_outbox WHERE kind = \'cron.execute\'')).rows).toEqual([{ attempts: 1 }, { attempts: 1 }])
}, 30000)

test('provider failure survives schedule advancement and recovers without raw exception text', async () => {
  const { tick, application, db, messages } = await fixture()
  const summary = await tick(async () => {
    throw new Error('provider credential=PRIVATE')
  })
  expect(summary.delivery.failed).toBe(2)
  expect((await application.repositories.cronJobSchedules.findById('fixture'))?.nextRunAt.toISOString()).toBe('2026-07-03T12:05:00.000Z')
  expect(JSON.stringify((await db.query('SELECT * FROM command_outbox')).rows)).not.toContain('PRIVATE')
  expect((await tick()).dispatches).toEqual([])
  await db.exec('UPDATE command_outbox SET next_attempt_at = now() - INTERVAL \'1 second\' WHERE kind = \'cron.dispatch\'')
  expect((await tick()).delivery.completed).toBe(2)
  expect(messages).toHaveLength(2)
}, 30000)

test('a lost accepted queue delivery is redriven by reference without resetting its persistent budget', async () => {
  const { tick, db, messages } = await fixture()
  await tick()
  const original = messages.map(message => message.jobId).sort()
  await db.exec('UPDATE command_outbox SET updated_at = now() - INTERVAL \'2 minutes\' WHERE kind = \'cron.dispatch\'')
  await tick()
  expect(messages.slice(2).map(message => message.jobId).sort()).toEqual(original)
  expect((await db.query('SELECT attempts FROM command_outbox WHERE kind = \'cron.dispatch\'')).rows).toEqual([{ attempts: 2 }, { attempts: 2 }])
  await db.exec('UPDATE command_outbox SET attempts = 8, updated_at = now() - INTERVAL \'2 minutes\' WHERE kind = \'cron.dispatch\'')
  expect((await tick()).dispatches).toEqual([])
  expect((await db.query('SELECT status FROM command_outbox WHERE kind = \'cron.dispatch\'')).rows).toEqual([{ status: 'dead' }, { status: 'dead' }])
}, 30000)

test('unsupported versions and school substitutions cannot execute a persisted occurrence', async () => {
  const { tick, db, messages, application } = await fixture()
  await tick()
  await db.exec('UPDATE command_outbox SET version = 2 WHERE kind = \'cron.execute\' AND school_id = \'school-a\'; UPDATE command_outbox SET school_id = \'foreign\' WHERE kind = \'cron.execute\' AND school_id = \'school-b\'')
  for (const { jobId } of messages)
    expect(await executeCronOccurrence(application, jobId)).toBe('ack')
  expect((await db.query('SELECT failure_code FROM command_outbox WHERE kind = \'cron.execute\' ORDER BY failure_code')).rows).toEqual([{ failure_code: 'CRON_OCCURRENCE_INVALID' }, { failure_code: 'CRON_VERSION_UNSUPPORTED' }])
}, 30000)

test('failed schedule advancement rolls back occurrences, receipts, audit and outbox before any send', async () => {
  const { tick, application, db, messages } = await fixture()
  application.repositories.cronJobSchedules.advanceSchedule = async () => {
    throw new Error('injected schedule write failure')
  }
  await expect(tick()).rejects.toThrow('injected schedule write failure')
  for (const table of ['cron_occurrences', 'command_receipts', 'command_audit', 'command_outbox'])
    expect((await db.query(`SELECT * FROM ${table}`)).rows).toEqual([])
  expect(messages).toEqual([])
  expect((await application.repositories.cronJobSchedules.findById('fixture'))?.nextRunAt.toISOString()).toBe('2026-07-03T12:00:00.000Z')
}, 30000)
