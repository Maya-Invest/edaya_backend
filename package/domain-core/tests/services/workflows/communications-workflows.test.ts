import {
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import { noOpNotificationGateway, RecordingNotificationGateway } from '../../../src/adapters'
import { SchoolService } from '../../../src/application'
import { AuthorizationError, createSystemActorMetadata } from '../../../src/capabilities/authorization'
import { ANNOUNCEMENT_PUBLISHED_EVENT_KEY } from '../../../src/capabilities/notifications'
import {
  AnnouncementStatus,
  MessageDelivery,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
  AnnouncementTargetKind as TargetKind,
} from '../../../src/domain'
import { BusinessRuleViolationError } from '../../../src/domain/shared/business-rule-error'
import { testFileStorage } from '../../support/test-file-storage'
import {
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
})
