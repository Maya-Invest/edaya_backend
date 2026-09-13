import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import { applyNotifySchemaOnDrizzle, createNotifyNotificationGateway, createNotifyRuntimeFromDrizzle, drainPendingSchoolNotifications } from '@edaya/adaptor-notify'
import { PostgresAtomicExecution, transactionContext } from '@edaya/adaptor-postgres'
import { MessageDeliveryRecipientKind } from '@edaya/core'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')
const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
let emails = 0
let pushes = 0
let failPush = true
const runtimes = handles.map(handle => createNotifyRuntimeFromDrizzle({
  db: handle.db,
  getExecutor: () => transactionContext.getStore() ?? handle.db,
  env: { EMAIL_TRANSPORT: 'log' },
  email: { send: async () => {
    emails++
    return { providerMessageId: 'synthetic-email' }
  } },
  fcm: { send: async () => {
    pushes++
    if (failPush)
      throw new Error('Synthetic push failure')
    return {}
  } },
}))
const runtime = runtimes[0]!
const gateway = createNotifyNotificationGateway({ runtime })
const recipient = { kind: MessageDeliveryRecipientKind.Guardian, id: 'outbox-guardian', subjectId: 'outbox-subject' }
const intent = (id: string) => ({ idempotencyKey: id, schoolId: 'outbox-school', kind: 'event' as const, eventKey: 'test', title: 'Synthetic', body: 'Fixture only', recipients: [recipient] })
beforeAll(async () => {
  await applyNotifySchemaOnDrizzle(handles[0]!.db)
  for (const runtime of runtimes) runtime.resolveSchoolRecipient = async () => ({ schoolId: 'outbox-school', recipient, email: 'fixture@example.test', preferences: { channels: { email: true, push: true } } })
  await gateway.registerPushDevice!({ schoolId: 'outbox-school', subjectId: recipient.subjectId, provider: 'fcm', token: 'synthetic-device' })
})
afterAll(async () => {
  await Promise.all(handles.map(handle => handle.dispose()))
})

test('pool-size-one enqueue joins the transaction and rolls back without sending', async () => {
  const atomic = new PostgresAtomicExecution(handles[0]!.db as PostgresTransactionalDb)
  await expect(atomic.execute(async () => {
    await gateway.enqueue(intent('outbox-rollback'))
    throw new Error('Rollback fixture')
  })).rejects.toThrow('Rollback fixture')
  expect(await runtime.sql.query('SELECT idempotency_key FROM notify.jobs WHERE idempotency_key = $1', ['outbox-rollback'])).toHaveLength(0)
  expect(emails).toBe(0)
}, 10000)

test('two dispatchers claim once and retry only the failed channel', async () => {
  await gateway.enqueue(intent('outbox-partial'))
  expect(emails).toBe(0)
  await Promise.all(runtimes.map(item => drainPendingSchoolNotifications(item)))
  expect(emails).toBe(1)
  expect(pushes).toBe(1)
  const [job] = await runtime.sql.query<{ status: string }>('SELECT status FROM notify.jobs WHERE idempotency_key = $1', ['outbox-partial'])
  expect(job?.status).toBe('failed')
  failPush = false
  await runtime.sql.execute('UPDATE notify.jobs SET next_attempt_at = NULL WHERE idempotency_key = $1', ['outbox-partial'])
  await drainPendingSchoolNotifications(runtime)
  expect(emails).toBe(1)
  expect(pushes).toBe(2)
  await drainPendingSchoolNotifications(runtime)
  expect(pushes).toBe(2)
})

test('an expired dispatch lease is recovered by another instance', async () => {
  await gateway.enqueue(intent('outbox-recover'))
  await runtime.sql.execute('UPDATE notify.jobs SET status = \'sending\', lease_id = \'dead-worker\', lease_expires_at = NOW() - INTERVAL \'1 minute\' WHERE idempotency_key = $1', ['outbox-recover'])
  await drainPendingSchoolNotifications(runtimes[1]!)
  const [job] = await runtime.sql.query<{ status: string }>('SELECT status FROM notify.jobs WHERE idempotency_key = $1', ['outbox-recover'])
  expect(job?.status).toBe('sent')
})
