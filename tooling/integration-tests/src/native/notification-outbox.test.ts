import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import { createNotifyInvitationDeliveryPort, createNotifyNotificationGateway, createNotifyRuntimeFromDrizzle, drainPendingSchoolNotifications } from '@edaya/adaptor-notify'
import { PostgresAtomicExecution, PostgresSchoolRepositories, runMigrations, transactionContext } from '@edaya/adaptor-postgres'
import { createSystemActorMetadata } from '@edaya/authorization'
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, MessageDeliveryRecipientKind, noOpFileStorage, noOpNotificationGateway, School, StaffMember } from '@edaya/core'
import { resolveInvitationDispatchRecipient, SchoolApplication } from '@edaya/service'
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
  await runMigrations(handles[0]!.db, { driver: 'node-postgres' })
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
  expect(await runtime.sql.query('SELECT idempotency_key FROM notify.jobs WHERE delivery_id = $1 AND tenant = \'outbox-school\'', ['outbox-rollback'])).toHaveLength(0)
  expect(emails).toBe(0)
}, 10000)

test('two dispatchers claim once and retry only the failed channel', async () => {
  await gateway.enqueue(intent('outbox-partial'))
  expect(emails).toBe(0)
  await Promise.all(runtimes.map(item => drainPendingSchoolNotifications(item)))
  expect(emails).toBe(1)
  expect(pushes).toBe(1)
  const [job] = await runtime.sql.query<{ status: string }>('SELECT status FROM notify.jobs WHERE delivery_id = $1 AND tenant = \'outbox-school\'', ['outbox-partial'])
  expect(job?.status).toBe('failed')
  failPush = false
  await runtime.sql.execute('UPDATE notify.jobs SET next_attempt_at = NULL WHERE delivery_id = $1 AND tenant = \'outbox-school\'', ['outbox-partial'])
  await drainPendingSchoolNotifications(runtime)
  expect(emails).toBe(1)
  expect(pushes).toBe(2)
  await drainPendingSchoolNotifications(runtime)
  expect(pushes).toBe(2)
})

test('an expired dispatch lease is recovered by another instance', async () => {
  await gateway.enqueue(intent('outbox-recover'))
  await runtime.sql.execute('UPDATE notify.jobs SET status = \'sending\', lease_id = \'dead-worker\', lease_expires_at = NOW() - INTERVAL \'1 minute\' WHERE delivery_id = $1 AND tenant = \'outbox-school\'', ['outbox-recover'])
  await drainPendingSchoolNotifications(runtimes[1]!)
  const [job] = await runtime.sql.query<{ status: string }>('SELECT status FROM notify.jobs WHERE delivery_id = $1 AND tenant = \'outbox-school\'', ['outbox-recover'])
  expect(job?.status).toBe('sent')
})

test('independent workers preserve identical delivery IDs and device registrations in two schools', async () => {
  for (const item of runtimes)
    item.resolveSchoolRecipient = async request => ({ schoolId: request.schoolId, recipient, email: 'fixture@example.test', preferences: { channels: { email: true, push: true } } })
  const beforeEmails = emails
  const beforePushes = pushes
  await gateway.registerPushDevice!({ schoolId: 'other-outbox-school', subjectId: recipient.subjectId, provider: 'fcm', token: 'other-synthetic-device' })
  await gateway.enqueue(intent('shared-logical-delivery'))
  await createNotifyNotificationGateway({ runtime: runtimes[1]! }).enqueue({ ...intent('shared-logical-delivery'), schoolId: 'other-outbox-school' })
  await gateway.unregisterPushDevice!({ schoolId: 'outbox-school', subjectId: recipient.subjectId, provider: 'fcm' })
  await Promise.all(runtimes.map(item => drainPendingSchoolNotifications(item)))
  expect(emails - beforeEmails).toBe(2)
  expect(pushes - beforePushes).toBe(1)
  expect(await runtime.sql.query('SELECT tenant, status FROM notify.jobs WHERE delivery_id = $1 ORDER BY tenant', ['shared-logical-delivery'])).toEqual([
    { tenant: 'other-outbox-school', status: 'sent' },
    { tenant: 'outbox-school', status: 'sent' },
  ])
})

test('invitation intent rolls back with business state and dispatches only after commit with current expiry', async () => {
  const repositories = handles.map(handle => new PostgresSchoolRepositories(handle.db))
  const atomic = new PostgresAtomicExecution(handles[0]!.db as PostgresTransactionalDb)
  const apps = handles.map((handle, index) => new SchoolApplication({
    repositories: repositories[index]!,
    atomicExecution: new PostgresAtomicExecution(handle.db as PostgresTransactionalDb),
    fileStorage: noOpFileStorage,
    notificationGateway: noOpNotificationGateway,
  }))
  let sends = 0
  for (const [index, item] of runtimes.entries()) {
    item.resolveInvitationRecipient = request => resolveInvitationDispatchRecipient(apps[index]!.forActor(createSystemActorMetadata({
      schoolId: request.schoolId,
      systemId: 'invitation-dispatch',
      requestId: 'dispatch-test',
      reason: 'Native fixture',
    })).baseService, request)
    item.email = { send: async () => {
      expect(transactionContext.getStore()).toBeUndefined()
      await item.sql.query('SELECT 1')
      sends++
      return { providerMessageId: 'native-invitation' }
    } }
  }
  const repo = repositories[0]!
  await repo.schools.save(new School({ id: 'invitation-school', name: 'Invitations', timeZone: 'UTC' }))
  await repo.staffMembers.save(new StaffMember({ id: 'invitation-creator', schoolId: 'invitation-school', firstName: 'Fixture', lastName: 'Staff' }))
  const port = createNotifyInvitationDeliveryPort(runtime)
  const enqueue = async (id: string) => {
    const invitation = new AccountInvitation({ id, schoolId: 'invitation-school', kind: AccountInvitationKind.Staff, targetId: 'invitation-creator', createdByStaffId: 'invitation-creator', contactChannel: AccountInvitationContactChannel.Email, contactValue: 'synthetic@example.test', tokenHash: `hash-${id}`, expiresAt: new Date(Date.now() + 60000) })
    await repo.accountInvitations.save(invitation)
    await port.deliver({ invitationId: id, schoolId: invitation.schoolId, contactChannel: invitation.contactChannel, contactValue: invitation.contactValue, displayName: 'Synthetic', actorKind: invitation.kind, inviteUrl: 'https://example.test/synthetic-only', expiresAt: invitation.expiresAt, emailSubject: 'Fixture', emailBody: 'Synthetic' })
    expect(sends).toBe(0)
    return invitation
  }
  await expect(atomic.execute(async () => {
    await enqueue('invitation-rollback')
    throw new Error('Rollback invitation')
  })).rejects.toThrow('Rollback invitation')
  expect(await repo.accountInvitations.findById('invitation-rollback')).toBeUndefined()
  expect(await runtime.sql.query('SELECT idempotency_key FROM notify.jobs WHERE delivery_id = \'invitation-rollback\'')).toHaveLength(0)
  await atomic.execute(() => enqueue('invitation-committed'))
  const expired = await atomic.execute(() => enqueue('invitation-expired'))
  await repo.accountInvitations.save(expired.copyWith({ expiresAt: new Date(0), status: AccountInvitationStatus.Pending }))
  await Promise.all(runtimes.map(item => drainPendingSchoolNotifications(item)))
  expect(sends).toBe(1)
  expect(await runtime.sql.query('SELECT delivery_id, status FROM notify.jobs WHERE tenant = \'invitation-school\' ORDER BY delivery_id')).toEqual([
    { delivery_id: 'invitation-committed', status: 'sent' },
    { delivery_id: 'invitation-expired', status: 'cancelled' },
  ])
}, 10000)
