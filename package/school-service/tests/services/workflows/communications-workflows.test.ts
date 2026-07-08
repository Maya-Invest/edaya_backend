import {
  ActorAssuranceLevel,
  AuthorizationError,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createSystemActorMetadata,
} from '@edaya/authorization'
import { AnnouncementStatus, BusinessRuleViolationError, MessageDelivery, MessageDeliveryRecipientKind, MessageDeliveryStatus, noOpNotificationGateway, RecordingNotificationGateway, AnnouncementTargetKind as TargetKind } from '@edaya/core'
import { SchoolService } from '@edaya/school-service'
import {
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import { ANNOUNCEMENT_PUBLISHED_EVENT_KEY } from '../../../src/capabilities/notifications'
import { portalScopeForGuardian } from '../../support/effective-grants'
import { testFileStorage } from '../../support/test-file-storage'
import {
  actor,
  createCommunicationsContext,
} from './workflow-test-context'

const deliveryContent = {
  schoolId: 'sch1',
  title: 'Announcement',
  body: 'Content',
}

describe('SchoolService communications workflows', () => {
  test('publishAnnouncement publishes only announcements with targets through managed service', async () => {
    const { mockRepos, service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    const result = await service.communicationsWorkflow.publishAnnouncement({
      announcementId: 'ann1',
      publishedAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(result.status).toBe(AnnouncementStatus.Published)
    expect(result.publishedAt?.toISOString()).toBe('2026-05-02T00:00:00.000Z')
    expect(mockRepos.announcements.save).toHaveBeenCalledWith(result)
  })

  test('publishAnnouncement rejects announcements without targets', async () => {
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
      targets: [],
    })

    await expect(service.communicationsWorkflow.publishAnnouncement({
      announcementId: 'ann1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('publishAnnouncement allows same-day expiresAt when publishing a draft', async () => {
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
      expiresAt: new Date('2026-05-02'),
    })

    const result = await service.communicationsWorkflow.publishAnnouncement({
      announcementId: 'ann1',
      publishedAt: new Date('2026-05-02T12:00:00Z'),
    })

    expect(result.status).toBe(AnnouncementStatus.Published)
    expect(result.expiresAt?.toISOString().slice(0, 10)).toBe('2026-05-02')
  })

  test('publishAnnouncement can defer notification dispatch', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
      notificationGateway: gateway,
    })

    const result = await service.communicationsWorkflow.publishAnnouncement({
      announcementId: 'ann1',
      publishedAt: new Date('2026-05-02T00:00:00Z'),
    }, { deferNotifications: true })

    expect(result.status).toBe(AnnouncementStatus.Published)
    expect(gateway.enqueued).toHaveLength(0)

    await service.communicationsWorkflow.dispatchPublishedAnnouncementNotifications('ann1')

    expect(gateway.enqueued.length).toBeGreaterThanOrEqual(2)
  })

  test('publishAnnouncement enqueues one notification per materialized delivery', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
      notificationGateway: gateway,
    })

    await service.communicationsWorkflow.publishAnnouncement({
      announcementId: 'ann1',
      publishedAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(gateway.enqueued.length).toBeGreaterThanOrEqual(2)
    expect(gateway.enqueued[0]).toMatchObject({
      schoolId: 'sch1',
      kind: 'ad_hoc',
      eventKey: ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
      announcementId: 'ann1',
    })
    expect(gateway.enqueued.map(entry => entry.idempotencyKey)).toEqual(
      expect.arrayContaining([
        'delivery:ann1:subject:staff1',
        'delivery:ann1:subject:stu1',
      ]),
    )
  })

  test('recordDelivery persists eligible recipients through managed service', async () => {
    const { mockRepos, service } = createCommunicationsContext()

    const result = await service.communicationsWorkflow.recordDelivery({
      id: 'del1',
      ...deliveryContent,
      announcementId: 'ann1',
      subjectId: 'subject:stu1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      status: MessageDeliveryStatus.Sent,
      sentAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(result.id).toBe('del1')
    expect(result.status).toBe(MessageDeliveryStatus.Sent)
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledWith(result)
  })

  test('recordDelivery rejects recipients outside announcement targets', async () => {
    const { service } = createCommunicationsContext({
      targets: [{ id: 'target-staff', announcementId: 'ann1', targetKind: TargetKind.StaffMember, targetId: 'staff1' }],
    })

    await expect(service.communicationsWorkflow.recordDelivery({
      id: 'del1',
      ...deliveryContent,
      announcementId: 'ann1',
      subjectId: 'subject:stu1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordDelivery rejects unpublished announcements and cross-school recipients', async () => {
    const unpublishedContext = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    await expect(unpublishedContext.service.communicationsWorkflow.recordDelivery({
      id: 'del-unpublished',
      ...deliveryContent,
      announcementId: 'ann1',
      subjectId: 'subject:stu1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    const crossSchoolContext = createCommunicationsContext()
    ;(crossSchoolContext.mockRepos as any).students.findById = mock(async () => ({ id: 'stu1', schoolId: 'other-school' }))

    await expect(crossSchoolContext.service.communicationsWorkflow.recordDelivery({
      id: 'del-cross-school',
      ...deliveryContent,
      announcementId: 'ann1',
      subjectId: 'subject:stu1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('recordDelivery matches guardians through class-group announcement targets', async () => {
    const { service } = createCommunicationsContext({
      targets: [{ id: 'target-class', announcementId: 'ann1', targetKind: TargetKind.ClassGroup, targetId: 'cg1' }],
    })

    const result = await service.communicationsWorkflow.recordDelivery({
      id: 'del-guardian-class',
      ...deliveryContent,
      announcementId: 'ann1',
      subjectId: 'subject:gua1',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'gua1',
    })

    expect(result.recipientKind).toBe(MessageDeliveryRecipientKind.Guardian)
    expect(result.recipientId).toBe('gua1')
  })

  test('materializeDeliveries expands targets, reuses existing deliveries, and saves missing deliveries', async () => {
    const existing = new MessageDelivery({
      id: 'existing-delivery',
      ...deliveryContent,
      announcementId: 'ann1',
      subjectId: 'subject:gua1',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'gua1',
    })
    const { mockAtomic, mockRepos, service } = createCommunicationsContext({ existingDelivery: existing })

    const result = await service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
      createdAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(result.map(delivery => delivery.id)).toEqual([
      'existing-delivery',
      'delivery:ann1:subject:staff1',
      'delivery:ann1:subject:stu1',
    ])
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledTimes(2)
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'delivery:ann1:subject:staff1',
    }))
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'delivery:ann1:subject:stu1',
    }))
  })

  test('materializeDeliveries rejects unpublished announcements', async () => {
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    await expect(service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('materializeDeliveries expands every target kind and de-duplicates recipients', async () => {
    const { mockRepos, service } = createCommunicationsContext({
      targets: [
        { id: 'target-school', announcementId: 'ann1', targetKind: TargetKind.School },
        { id: 'target-staff-all', announcementId: 'ann1', targetKind: TargetKind.AllStaff },
        { id: 'target-guardian-all', announcementId: 'ann1', targetKind: TargetKind.AllGuardians },
        { id: 'target-student-all', announcementId: 'ann1', targetKind: TargetKind.AllStudents },
        { id: 'target-staff', announcementId: 'ann1', targetKind: TargetKind.StaffMember, targetId: 'staff1' },
        { id: 'target-guardian', announcementId: 'ann1', targetKind: TargetKind.Guardian, targetId: 'gua1' },
        { id: 'target-student', announcementId: 'ann1', targetKind: TargetKind.Student, targetId: 'stu1' },
        { id: 'target-class', announcementId: 'ann1', targetKind: TargetKind.ClassGroup, targetId: 'cg1' },
        { id: 'target-grade', announcementId: 'ann1', targetKind: TargetKind.GradeLevel, targetId: 'grade1' },
      ],
    })

    const result = await service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
      createdAt: new Date('2026-05-03T00:00:00Z'),
    })

    expect(result.map(delivery => `${delivery.recipientKind}:${delivery.recipientId}`)).toEqual([
      'guardian:gua1',
      'staff:staff1',
      'student:stu1',
    ])
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledTimes(3)
  })

  test('materializeDeliveries rejects cross-school targets and linked recipients', async () => {
    const crossSchoolTarget = createCommunicationsContext({
      targets: [{ id: 'target-class', announcementId: 'ann1', targetKind: TargetKind.ClassGroup, targetId: 'cg1' }],
    })
    ;(crossSchoolTarget.mockRepos as any).classGroups.findById = mock(async () => ({ id: 'cg1', schoolId: 'other-school', gradeLevelId: 'grade1' }))

    await expect(crossSchoolTarget.service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
    })).rejects.toBeInstanceOf(AuthorizationError)

    const crossSchoolLinkedGuardian = createCommunicationsContext({
      targets: [{ id: 'target-class', announcementId: 'ann1', targetKind: TargetKind.ClassGroup, targetId: 'cg1' }],
    })
    ;(crossSchoolLinkedGuardian.mockRepos as any).guardians.findById = mock(async () => ({ id: 'gua1', schoolId: 'other-school' }))

    await expect(crossSchoolLinkedGuardian.service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('applyDeliveryEvent transitions pending deliveries to sent', async () => {
    const { service } = createCommunicationsContext({
      existingDelivery: new MessageDelivery({
        id: 'delivery:ann1:subject:stu1',
        ...deliveryContent,
        announcementId: 'ann1',
        subjectId: 'subject:stu1',
        recipientKind: MessageDeliveryRecipientKind.Student,
        recipientId: 'stu1',
      }),
    })

    const result = await service.communicationsWorkflow.applyDeliveryEvent({
      deliveryId: 'delivery:ann1:subject:stu1',
      status: MessageDeliveryStatus.Sent,
      providerMessageId: 'novu-msg-1',
      occurredAt: new Date('2026-05-02T12:00:00Z'),
    })

    expect(result?.status).toBe(MessageDeliveryStatus.Sent)
    expect(result?.providerMessageId).toBe('novu-msg-1')
  })

  test('applyDeliveryEvent allows system actor without communication create permission', async () => {
    const existingDelivery = new MessageDelivery({
      id: 'delivery:ann1:subject:stu1',
      ...deliveryContent,
      announcementId: 'ann1',
      subjectId: 'subject:stu1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
    })
    const { mockAtomic, mockPolicy, mockRepos, savedDeliveries } = createCommunicationsContext({ existingDelivery })
    const systemService = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: mockPolicy,
      actor: createSystemActorMetadata({
        systemId: 'notification-delivery-webhook',
        schoolId: 'sch1',
        requestId: 'req-delivery-webhook-1',
        reason: 'test webhook',
      }),
      atomicExecution: mockAtomic,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    const result = await systemService.communicationsWorkflow.applyDeliveryEvent({
      deliveryId: 'delivery:ann1:subject:stu1',
      status: MessageDeliveryStatus.Sent,
      occurredAt: new Date('2026-05-02T12:00:00Z'),
    })

    expect(result?.status).toBe(MessageDeliveryStatus.Sent)
    expect(savedDeliveries.get('delivery:ann1:subject:stu1')?.status).toBe(MessageDeliveryStatus.Sent)
  })

  test('createAnnouncement and addTarget persist draft content and audience', async () => {
    const { mockRepos, service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    const announcement = await service.communicationsWorkflow.createAnnouncement({
      id: 'ann-draft',
      schoolId: 'sch1',
      title: 'Draft notice',
      content: 'Draft body',
      createdBy: 'user1',
      status: AnnouncementStatus.Draft,
    })
    const target = await service.communicationsWorkflow.addTarget({
      id: 'target-draft',
      announcementId: 'ann-draft',
      targetKind: TargetKind.AllStudents,
    })

    expect(announcement.status).toBe(AnnouncementStatus.Draft)
    expect(target.targetKind).toBe(TargetKind.AllStudents)
    expect(mockRepos.announcements.save).toHaveBeenCalledWith(announcement)
    expect(mockRepos.announcementTargets.save).toHaveBeenCalledWith(target)
  })

  test('recordDelivery without announcementId records ad-hoc deliveries', async () => {
    const { service } = createCommunicationsContext()

    const result = await service.communicationsWorkflow.recordDelivery({
      id: 'del-adhoc',
      schoolId: 'sch1',
      title: 'Manual notice',
      body: 'Manual body',
      subjectId: 'subject:staff1',
      recipientKind: MessageDeliveryRecipientKind.Staff,
      recipientId: 'staff1',
      status: MessageDeliveryStatus.Sent,
      sentAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(result.eventKey).toBeUndefined()
    expect(result.announcementId).toBeUndefined()
  })

  test('applyDeliveryEvent returns undefined for unknown deliveries and ignores invalid transitions', async () => {
    const { savedDeliveries, service } = createCommunicationsContext({
      existingDelivery: new MessageDelivery({
        id: 'delivery:ann1:subject:stu1',
        ...deliveryContent,
        announcementId: 'ann1',
        subjectId: 'subject:stu1',
        recipientKind: MessageDeliveryRecipientKind.Student,
        recipientId: 'stu1',
        status: MessageDeliveryStatus.Sent,
        sentAt: new Date('2026-05-02T00:00:00Z'),
      }),
    })

    await expect(service.communicationsWorkflow.applyDeliveryEvent({
      deliveryId: 'missing-delivery',
      status: MessageDeliveryStatus.Read,
    })).resolves.toBeUndefined()

    const unchanged = await service.communicationsWorkflow.applyDeliveryEvent({
      deliveryId: 'delivery:ann1:subject:stu1',
      status: MessageDeliveryStatus.Sent,
    })

    expect(unchanged?.status).toBe(MessageDeliveryStatus.Sent)
    expect(savedDeliveries.get('delivery:ann1:subject:stu1')?.status).toBe(MessageDeliveryStatus.Sent)
  })

  test('applyDeliveryEvent marks sent deliveries as read', async () => {
    const { service } = createCommunicationsContext({
      existingDelivery: new MessageDelivery({
        id: 'delivery:ann1:subject:stu1',
        ...deliveryContent,
        announcementId: 'ann1',
        subjectId: 'subject:stu1',
        recipientKind: MessageDeliveryRecipientKind.Student,
        recipientId: 'stu1',
        status: MessageDeliveryStatus.Sent,
        sentAt: new Date('2026-05-02T00:00:00Z'),
      }),
    })

    const result = await service.communicationsWorkflow.applyDeliveryEvent({
      deliveryId: 'delivery:ann1:subject:stu1',
      status: MessageDeliveryStatus.Read,
      occurredAt: new Date('2026-05-03T00:00:00Z'),
    })

    expect(result?.status).toBe(MessageDeliveryStatus.Read)
    expect(result?.readAt?.toISOString()).toBe('2026-05-03T00:00:00.000Z')
  })

  test('markDeliveryRead allows the recipient actor to mark their delivery read', async () => {
    const guardianActor = createGuardianActorMetadata({
      guardianId: 'gua1',
      subjectId: 'subject:gua1',
      schoolId: 'sch1',
      requestId: 'request',
      authenticatedAt: new Date('2026-05-02T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
      guardianScope: portalScopeForGuardian(['stu1'], ['cg1']),
    })
    const { service } = createCommunicationsContext({
      actorOverride: guardianActor,
      existingDelivery: new MessageDelivery({
        id: 'delivery:ann1:subject:gua1',
        ...deliveryContent,
        announcementId: 'ann1',
        subjectId: 'subject:gua1',
        recipientKind: MessageDeliveryRecipientKind.Guardian,
        recipientId: 'gua1',
        status: MessageDeliveryStatus.Sent,
        sentAt: new Date('2026-05-02T00:00:00Z'),
      }),
    })

    const result = await service.communicationsWorkflow.markDeliveryRead({
      deliveryId: 'delivery:ann1:subject:gua1',
      readAt: new Date('2026-05-03T00:00:00Z'),
    })

    expect(result.status).toBe(MessageDeliveryStatus.Read)
  })

  test('markDeliveryRead rejects actors that do not own the delivery subject', async () => {
    const { service } = createCommunicationsContext({
      existingDelivery: new MessageDelivery({
        id: 'delivery:ann1:subject:gua1',
        ...deliveryContent,
        announcementId: 'ann1',
        subjectId: 'subject:gua1',
        recipientKind: MessageDeliveryRecipientKind.Guardian,
        recipientId: 'gua1',
        status: MessageDeliveryStatus.Sent,
        sentAt: new Date('2026-05-02T00:00:00Z'),
      }),
    })

    await expect(service.communicationsWorkflow.markDeliveryRead({
      deliveryId: 'delivery:ann1:subject:gua1',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('updateNotificationContact updates staff notification channels', async () => {
    const staffActor = createStaffActorMetadata({
      subjectId: 'subject:staff1',
      staffMemberId: 'staff1',
      schoolId: 'sch1',
      requestId: 'request',
      authenticatedAt: new Date('2026-05-02T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: actor.effectiveGrants,
    })
    const gateway = new RecordingNotificationGateway()
    const { service } = createCommunicationsContext({
      actorOverride: staffActor,
      notificationGateway: gateway,
    })

    const result = await service.communicationsWorkflow.updateNotificationContact({
      notificationEmail: ' alerts@school.test ',
      notificationPhone: ' +22501020304 ',
    })

    expect(result.notificationEmail).toBe('alerts@school.test')
    expect(result.notificationPhone).toBe('+22501020304')
    expect(gateway.upserted.length).toBeGreaterThan(0)
  })

  test('updateNotificationContact updates guardian notification channels', async () => {
    const guardianActor = createGuardianActorMetadata({
      guardianId: 'gua1',
      subjectId: 'subject:gua1',
      schoolId: 'sch1',
      requestId: 'request',
      authenticatedAt: new Date('2026-05-02T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
      guardianScope: portalScopeForGuardian(['stu1'], ['cg1']),
    })
    const { service } = createCommunicationsContext({ actorOverride: guardianActor })

    const result = await service.communicationsWorkflow.updateNotificationContact({
      notificationEmail: 'guardian@school.test',
    })

    expect(result.notificationEmail).toBe('guardian@school.test')
  })

  test('registerPushDevice and unregisterPushDevice delegate to the notification gateway', async () => {
    const staffActor = createStaffActorMetadata({
      subjectId: 'subject:staff1',
      staffMemberId: 'staff1',
      schoolId: 'sch1',
      requestId: 'request',
      authenticatedAt: new Date('2026-05-02T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: actor.effectiveGrants,
    })
    const gateway = new RecordingNotificationGateway()
    const { service } = createCommunicationsContext({
      actorOverride: staffActor,
      notificationGateway: gateway,
    })

    await service.communicationsWorkflow.registerPushDevice({
      token: ' device-token ',
      provider: 'fcm',
    })
    await service.communicationsWorkflow.unregisterPushDevice({ provider: 'fcm' })

    expect(gateway.registeredPushDevices).toEqual([{
      subjectId: 'subject:staff1',
      schoolId: 'sch1',
      token: 'device-token',
      provider: 'fcm',
    }])
    expect(gateway.unregisteredPushDevices).toEqual([{
      subjectId: 'subject:staff1',
      provider: 'fcm',
    }])
  })

  test('dispatchPublishedAnnouncementNotifications rejects unpublished announcements', async () => {
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    await expect(service.communicationsWorkflow.dispatchPublishedAnnouncementNotifications('ann1'))
      .rejects
      .toBeInstanceOf(BusinessRuleViolationError)
  })

  test('materializeDeliveries skips recipients without linked subject ids', async () => {
    const { mockRepos, service } = createCommunicationsContext({
      targets: [{ id: 'target-staff', announcementId: 'ann1', targetKind: TargetKind.StaffMember, targetId: 'staff-no-subject' }],
    })

    const result = await service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
    })

    expect(result).toEqual([])
    expect(mockRepos.messageDeliveries.save).not.toHaveBeenCalled()
  })
})
