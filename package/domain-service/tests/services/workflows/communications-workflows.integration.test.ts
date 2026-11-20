import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import { ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createSystemActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Announcement, AnnouncementStatus, AnnouncementTarget, BusinessRuleViolationError, MessageDelivery, Permission, MessageDeliveryRecipientKind as Recipient, RecordingNotificationGateway, StaffPermissionAssignment, MessageDeliveryStatus as Status, AnnouncementTargetKind as Target } from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { ANNOUNCEMENT_PUBLISHED_EVENT_KEY, cancelNotificationDeliveries, deliverNotification } from '../../../src/capabilities/notifications'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

const identity = { schoolId: 'school-a', subjectId: 'person-a', requestId: 'communications-workflow', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }
const staff = createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })
const guardian = createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' })
const student = createStudentActorMetadata({ ...identity, studentId: 'student-a' })
const teacher = createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' })

describe('communications workflows with production policies and transactions', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let gateway: RecordingNotificationGateway
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'; UPDATE students SET subject_id = \'person-a\' WHERE id = \'student-a\';')
    gateway = new RecordingNotificationGateway()
  })
  afterEach(async () => {
    await releaseDatabase(fixture.db)
  })

  function service(actor: SchoolScopedActorMetadata = staff) {
    return new SchoolService({ commandJournal: new PostgresCommandJournal(), actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: gateway, fileStorage: testFileStorage, accountInvitationsEnabled: false })
  }
  async function announcement(kind: Target = Target.School, targetId?: string, extra = {}) {
    const record = new Announcement({ id: 'announcement', schoolId: 'school-a', title: 'News', content: 'School news', status: AnnouncementStatus.Draft, ...extra })
    await fixture.repositories.announcements.save(record)
    await fixture.repositories.announcementTargets.save(new AnnouncementTarget({ id: 'target', announcementId: record.id, targetKind: kind, targetId }))
    return record
  }
  async function delivery(kind: Recipient = Recipient.Guardian, extra = {}) {
    const record = new MessageDelivery({ id: `delivery-${kind}`, schoolId: 'school-a', subjectId: 'person-a', title: 'News', body: 'Private', recipientKind: kind, recipientId: `${kind}-a`, ...extra })
    await fixture.repositories.messageDeliveries.save(record)
    return record
  }

  test('publishing materializes a separate delivery for every selected profile, then reuses each on retry', async () => {
    await announcement()
    const workflow = service().communicationsWorkflow
    const published = await workflow.publishAnnouncement({ announcementId: 'announcement' })
    expect(published.isPublished).toBe(true)
    const first = await fixture.repositories.messageDeliveries.list({ $orderBy: [{ field: 'recipientKind', direction: 'asc' }] })
    expect(first.map(row => row.recipientKind)).toEqual([Recipient.Guardian, Recipient.Staff, Recipient.Student, Recipient.Teacher])
    expect(new Set(first.map(row => row.id)).size).toBe(4)
    expect(gateway.enqueued.map(message => message.idempotencyKey).sort()).toEqual(first.map(row => row.id).sort())
    expect(gateway.enqueued[0]?.eventKey).toBe(ANNOUNCEMENT_PUBLISHED_EVENT_KEY)
    await expect(workflow.materializeDeliveries({ announcementId: 'announcement' })).rejects.toBeInstanceOf(AuthorizationError)
    const retried = await service(createSystemActorMetadata({ schoolId: 'school-a', systemId: 'fixture-seed', requestId: 'retry', reason: 'Retry fixture deliveries' })).communicationsWorkflow.materializeDeliveries({ announcementId: 'announcement' })
    expect(retried.map(row => row.id).sort()).toEqual(first.map(row => row.id).sort())
    expect(await fixture.repositories.messageDeliveries.count()).toBe(4)
  })

  test.each([
    [Target.School, undefined, [Recipient.Guardian, Recipient.Staff, Recipient.Student, Recipient.Teacher]],
    [Target.AllStaff, undefined, [Recipient.Staff]],
    [Target.AllGuardians, undefined, [Recipient.Guardian]],
    [Target.AllStudents, undefined, [Recipient.Student]],
    [Target.StaffMember, 'staff-a', [Recipient.Staff]],
    [Target.Guardian, 'guardian-a', [Recipient.Guardian]],
    [Target.Student, 'student-a', [Recipient.Student]],
    [Target.ClassGroup, 'class-a', [Recipient.Guardian, Recipient.Student, Recipient.Teacher]],
    [Target.GradeLevel, 'level-a', [Recipient.Guardian, Recipient.Student, Recipient.Teacher]],
  ] as const)('%s dispatch and portal visibility use the same audience', async (kind, targetId, expected) => {
    await announcement(kind, targetId)
    await service().communicationsWorkflow.publishAnnouncement({ announcementId: 'announcement' })
    expect((await fixture.repositories.messageDeliveries.list({ $orderBy: [{ field: 'recipientKind', direction: 'asc' }] })).map(row => row.recipientKind)).toEqual([...expected])
  })

  test('system notifications keep shared-login profile delivery identities distinct on retries', async () => {
    const recipients = [{ kind: Recipient.Staff, id: 'staff-a', subjectId: 'person-a' }, { kind: Recipient.Guardian, id: 'guardian-a', subjectId: 'person-a' }]
    const input = { schoolId: 'school-a', kind: 'event' as const, eventKey: 'test.notice', idempotencyKeyPrefix: 'notice', title: 'Notice', body: 'Content', recipients }
    const deps = { repositories: fixture.repositories, notificationGateway: gateway }
    await fixture.atomic.execute(() => deliverNotification(deps, input))
    await fixture.atomic.execute(() => deliverNotification(deps, input))
    expect(await fixture.repositories.messageDeliveries.count()).toBe(2)
    expect(new Set(gateway.enqueued.map(message => message.idempotencyKey)).size).toBe(2)
    await expect(fixture.atomic.execute(() => deliverNotification(deps, { ...input, schoolId: 'school-b' }))).rejects.toBeInstanceOf(AuthorizationError)
    expect(gateway.enqueued).toHaveLength(2)
    await fixture.db.exec('UPDATE guardians SET has_access = false WHERE id = \'guardian-a\'')
    await fixture.atomic.execute(() => deliverNotification(deps, { ...input, idempotencyKeyPrefix: 'after-revocation' }))
    expect(gateway.enqueued).toHaveLength(3)
    expect(await fixture.repositories.messageDeliveries.count()).toBe(3)
  })

  test('retries and cancellation preserve persisted provider IDs, including revoked recipients', async () => {
    const original = await delivery(Recipient.Guardian, {
      id: 'delivery:test.notice:source:person-a',
      eventKey: 'test.notice',
      sourceKey: 'test.notice:source',
    })
    const deps = { repositories: fixture.repositories, notificationGateway: gateway }
    await fixture.atomic.execute(() => deliverNotification(deps, {
      schoolId: 'school-a',
      kind: 'event',
      eventKey: 'test.notice',
      idempotencyKeyPrefix: 'test.notice:source',
      title: 'News',
      body: 'Private',
      recipients: [{ kind: Recipient.Guardian, id: 'guardian-a' }],
    }))
    expect(gateway.enqueued.map(row => row.idempotencyKey)).toEqual([original.id])
    expect(await fixture.repositories.messageDeliveries.count()).toBe(1)
    await delivery(Recipient.Staff, { id: 'foreign-source', schoolId: 'school-b', recipientId: 'staff-b', subjectId: 'person-b', sourceKey: original.sourceKey, eventKey: original.eventKey })
    for (const row of await fixture.repositories.subjectEnrollments.list({ studentClassEnrollmentId: 'enrollment-a' }))
      await fixture.repositories.subjectEnrollments.delete(row.id)
    await fixture.db.exec('UPDATE guardians SET has_access = false, subject_id = NULL WHERE id = \'guardian-a\'; DELETE FROM student_class_enrollments WHERE id = \'enrollment-a\'')
    await cancelNotificationDeliveries(deps, 'school-a', original.sourceKey!)
    expect(gateway.cancelled).toEqual([original.id])
  })

  test('announcement retry reuses the source/profile delivery and retains its provider history', async () => {
    await announcement(Target.Guardian, 'guardian-a', { status: AnnouncementStatus.Published, publishedAt: new Date() })
    const original = await delivery(Recipient.Guardian, { id: 'older-provider-id', announcementId: 'announcement', sourceKey: 'announcement', status: Status.Sent, sentAt: new Date('2026-01-01'), providerMessageId: 'provider-original' })
    const workflow = service().communicationsWorkflow
    await workflow.dispatchPublishedAnnouncementNotifications('announcement')
    expect(gateway.enqueued.map(row => row.idempotencyKey)).toEqual([original.id])
    expect((await fixture.repositories.messageDeliveries.findById(original.id))?.data).toEqual(original.data)
    await service(guardian).communicationsWorkflow.markDeliveryRead({ deliveryId: original.id })
    expect((await fixture.repositories.messageDeliveries.findById(original.id))?.sourceKey).toBe('announcement')
  })

  test('deferred dispatch reloads current publication and actor authority', async () => {
    const workflow = service().communicationsWorkflow
    await announcement()
    await workflow.publishAnnouncement({ announcementId: 'announcement' }, { deferNotifications: true })
    await fixture.db.exec('UPDATE announcements SET status = \'draft\', published_at = NULL WHERE id = \'announcement\'')
    await expect(workflow.dispatchPublishedAnnouncementNotifications('announcement')).rejects.toBeInstanceOf(BusinessRuleViolationError)
    expect(gateway.enqueued).toHaveLength(0)
    await fixture.db.exec('UPDATE announcements SET status = \'published\', published_at = now() WHERE id = \'announcement\'; UPDATE staff_members SET is_active = false WHERE id = \'staff-a\'')
    await expect(workflow.dispatchPublishedAnnouncementNotifications('announcement')).rejects.toBeInstanceOf(AuthorizationError)
    expect(gateway.enqueued).toHaveLength(0)
  })

  test('delivery writes cannot change their source or login even for the owner', async () => {
    const original = await delivery(Recipient.Guardian, { sourceKey: 'test.notice:source', eventKey: 'test.notice' })
    const entity = service().baseService.entities.messageDeliveries
    for (const changes of [{ sourceKey: 'another-source' }, { eventKey: 'another-event' }, { subjectId: 'another-login' }]) {
      await expect(entity.save(new MessageDelivery({ ...original.data, ...changes }))).rejects.toBeInstanceOf(AuthorizationError)
    }
    expect((await fixture.repositories.messageDeliveries.findById(original.id))?.data).toEqual(original.data)
  })

  test('deferred dispatch preserves publication and sends only when explicitly dispatched', async () => {
    await announcement()
    const workflow = service().communicationsWorkflow
    await workflow.publishAnnouncement({ announcementId: 'announcement' }, { deferNotifications: true })
    expect(gateway.enqueued).toHaveLength(0)
    await workflow.dispatchPublishedAnnouncementNotifications('announcement')
    expect(gateway.enqueued).toHaveLength(4)
  })

  test('unpublished, expired and targetless announcements cannot create deliveries', async () => {
    await announcement()
    const workflow = service().communicationsWorkflow
    await expect(service(createSystemActorMetadata({ schoolId: 'school-a', systemId: 'fixture-seed', requestId: 'retry', reason: 'Verify publication invariant' })).communicationsWorkflow.materializeDeliveries({ announcementId: 'announcement' })).rejects.toBeInstanceOf(BusinessRuleViolationError)
    await expect(workflow.dispatchPublishedAnnouncementNotifications('announcement')).rejects.toBeInstanceOf(BusinessRuleViolationError)
    await fixture.repositories.announcementTargets.delete('target')
    await expect(workflow.publishAnnouncement({ announcementId: 'announcement' })).rejects.toBeInstanceOf(BusinessRuleViolationError)
    await announcement(Target.School, undefined, { expiresAt: new Date('2000-01-01') })
    await workflow.publishAnnouncement({ announcementId: 'announcement', publishedAt: new Date('2000-01-01') })
    expect(await fixture.repositories.messageDeliveries.count()).toBe(0)
  })

  test('class-scoped sending checks every target and rolls back unauthorized publication', async () => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = null WHERE id = \'school-a\'')
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'send-class', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.COMMUNICATION_SEND, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    await announcement(Target.ClassGroup, 'class-a')
    const workflow = service().communicationsWorkflow
    await fixture.repositories.announcementTargets.save(new AnnouncementTarget({ id: 'other-target', announcementId: 'announcement', targetKind: Target.ClassGroup, targetId: 'class-other' }))
    await expect(workflow.publishAnnouncement({ announcementId: 'announcement' })).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.announcements.findById('announcement'))?.status).toBe(AnnouncementStatus.Draft)
    expect(await fixture.repositories.messageDeliveries.count()).toBe(0)
    await fixture.repositories.announcementTargets.delete('other-target')
    await workflow.publishAnnouncement({ announcementId: 'announcement' })
    expect(await fixture.repositories.messageDeliveries.count()).toBe(3)
    await fixture.repositories.staffPermissionAssignments.delete('send-class')
    await expect(workflow.materializeDeliveries({ announcementId: 'announcement' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(workflow.dispatchPublishedAnnouncementNotifications('announcement')).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('communication update authority cannot send, and send authority cannot edit message content', async () => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = null WHERE id = \'school-a\'')
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'update', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.COMMUNICATION_DRAFT_MANAGE, scopes: [{ kind: 'school' }] }))
    const before = await announcement(Target.ClassGroup, 'class-a')
    await expect(service().communicationsWorkflow.publishAnnouncement({ announcementId: 'announcement' })).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.staffPermissionAssignments.delete('update')
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'send', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.COMMUNICATION_SEND, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    await expect(service().baseService.entities.announcements.save(new Announcement({ ...before.data, title: 'Changed', status: AnnouncementStatus.Published, publishedAt: new Date() }))).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.announcements.findById('announcement'))?.title).toBe('News')
  })

  test('owner publication rejects foreign targets and rolls back the existing draft', async () => {
    await announcement(Target.ClassGroup, 'class-b')
    await expect(service().communicationsWorkflow.publishAnnouncement({ announcementId: 'announcement' })).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.announcements.findById('announcement'))?.status).toBe(AnnouncementStatus.Draft)
    expect(gateway.enqueued).toHaveLength(0)
  })

  test('recording a delivery verifies the selected recipient, login, tenant and published audience', async () => {
    await announcement(Target.Guardian, 'guardian-a', { status: AnnouncementStatus.Published, publishedAt: new Date() })
    const input = { id: 'recorded', schoolId: 'school-a', title: 'News', body: 'Private', announcementId: 'announcement', subjectId: 'person-a', recipientKind: Recipient.Guardian, recipientId: 'guardian-a' }
    await expect(service().communicationsWorkflow.recordDelivery(input)).rejects.toBeInstanceOf(AuthorizationError)
    const workflow = service(createSystemActorMetadata({ schoolId: 'school-a', systemId: 'fixture-seed', requestId: 'record', reason: 'Import delivery history' })).communicationsWorkflow
    await workflow.recordDelivery(input)
    expect((await fixture.repositories.messageDeliveries.findById('recorded'))?.recipientId).toBe('guardian-a')
    await expect(workflow.recordDelivery({ ...input, id: 'wrong-profile', recipientKind: Recipient.Student, recipientId: 'student-a' })).rejects.toThrow()
    await expect(workflow.recordDelivery({ ...input, id: 'wrong-login', subjectId: 'another-login' })).rejects.toThrow()
    await expect(workflow.recordDelivery({ ...input, id: 'foreign', recipientKind: Recipient.Student, recipientId: 'student-b' })).rejects.toThrow()
    expect(await fixture.repositories.messageDeliveries.count()).toBe(1)
  })

  test.each([staff, guardian, student, teacher])('$kind can mark only their selected profile delivery read', async (actor) => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = null WHERE id = \'school-a\'')
    for (const kind of Object.values(Recipient)) await delivery(kind)
    const workflow = service(actor).communicationsWorkflow
    await workflow.markDeliveryRead({ deliveryId: `delivery-${actor.kind}` })
    for (const kind of Object.values(Recipient).filter(kind => kind !== actor.kind))
      await expect(workflow.markDeliveryRead({ deliveryId: `delivery-${kind}` })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.messageDeliveries.count({ status: Status.Read })).toBe(1)
    await fixture.db.exec(`UPDATE message_deliveries SET subject_id = 'previous-login' WHERE id = 'delivery-${actor.kind}'`)
    await expect(workflow.markDeliveryRead({ deliveryId: `delivery-${actor.kind}` })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('webhook authority is explicit even for no-op delivery transitions', async () => {
    const existing = await delivery()
    const webhook = createSystemActorMetadata({ systemId: 'notification-delivery-webhook', schoolId: 'school-a', requestId: 'event', reason: 'Delivery event' })
    const workflow = service(webhook).communicationsWorkflow
    await expect(workflow.applyDeliveryEvent({ deliveryId: 'missing', status: Status.Sent })).resolves.toBeUndefined()
    const sent = await workflow.applyDeliveryEvent({ deliveryId: existing.id, status: Status.Sent, occurredAt: new Date('2026-05-01') })
    expect(sent?.status).toBe(Status.Sent)
    const read = await workflow.applyDeliveryEvent({ deliveryId: existing.id, status: Status.Read, occurredAt: new Date('2026-05-02') })
    expect(read?.readAt?.toISOString()).toBe('2026-05-02T00:00:00.000Z')
    await expect(service({ ...webhook, systemId: 'unknown-job' }).communicationsWorkflow.applyDeliveryEvent({ deliveryId: existing.id, status: Status.Read })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service({ ...webhook, schoolId: 'school-b' }).communicationsWorkflow.applyDeliveryEvent({ deliveryId: existing.id, status: Status.Read })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(workflow.markDeliveryRead({ deliveryId: existing.id })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test.each([staff])('$kind can update personal notification contacts without staff-management permissions or student links', async (actor) => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = null WHERE id = \'school-a\'')
    await fixture.repositories.guardianLinks.delete('guardian-link')
    const before = (await fixture.repositories.staffMembers.findById(actor.actorId))!
    const updated = await service(actor).communicationsWorkflow.updateNotificationContact({ notificationEmail: ' alerts@example.test ', notificationPhone: ' +22501020304 ' })
    expect(updated.notificationEmail).toBe('alerts@example.test')
    expect(updated.notificationPhone).toBe('+22501020304')
    const { notificationEmail: _email, notificationPhone: _phone, ...rest } = updated.data
    const { notificationEmail: _oldEmail, notificationPhone: _oldPhone, ...original } = before.data
    expect(rest).toEqual(original)
  })

  test('push devices use the current linked identity, and inactive profiles lose access', async () => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = null WHERE id = \'school-a\'')
    const workflow = service(guardian).communicationsWorkflow
    await workflow.registerPushDevice({ appId: 'guardian', installationId: 'device-1', token: ' device-token ', provider: 'fcm' })
    await workflow.unregisterPushDevice({ appId: 'guardian', installationId: 'device-1', provider: 'fcm' })
    expect(gateway.registeredPushDevices).toEqual([{ appId: 'guardian', installationId: 'device-1', profileKind: 'guardian', profileId: 'guardian-a', subjectId: 'person-a', schoolId: 'school-a', token: 'device-token', provider: 'fcm' }])
    expect(gateway.unregisteredPushDevices).toEqual([{ appId: 'guardian', installationId: 'device-1', schoolId: 'school-a', subjectId: 'person-a', provider: 'fcm' }])
    await fixture.db.exec('UPDATE guardians SET has_access = false WHERE id = \'guardian-a\'')
    await expect(workflow.registerPushDevice({ appId: 'guardian', installationId: 'device-1', token: 'device-token', provider: 'fcm' })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
