import {
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import { AuthorizationError } from '../../../src/authorization'
import {
  AnnouncementStatus,
  MessageDelivery,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
  AnnouncementTargetKind as TargetKind,
} from '../../../src/domains'
import {
  ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
  RecordingNotificationGateway,
} from '../../../src/notifications'
import { BusinessRuleViolationError } from '../../../src/shared/business-rule-error'
import {
  createCommunicationsContext,
} from './workflow-test-context'

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

  test('publishAnnouncement enqueues ad-hoc notifications after materializing app deliveries', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
      notificationGateway: gateway,
    })

    await service.communicationsWorkflow.publishAnnouncement({
      announcementId: 'ann1',
      publishedAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      idempotencyKey: `${ANNOUNCEMENT_PUBLISHED_EVENT_KEY}:ann1`,
      schoolId: 'sch1',
      kind: 'ad_hoc',
      eventKey: ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
      announcementId: 'ann1',
      channels: [MessageDeliveryChannel.App],
    })
    expect(gateway.enqueued[0]?.recipients).toEqual(expect.arrayContaining([
      { kind: MessageDeliveryRecipientKind.Staff, id: 'staff1' },
      { kind: MessageDeliveryRecipientKind.Student, id: 'stu1' },
    ]))
  })

  test('recordDelivery persists eligible recipients through managed service', async () => {
    const { mockRepos, service } = createCommunicationsContext()

    const result = await service.communicationsWorkflow.recordDelivery({
      id: 'del1',
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      channel: MessageDeliveryChannel.Email,
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
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      channel: MessageDeliveryChannel.Email,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordDelivery rejects unpublished announcements and cross-school recipients', async () => {
    const unpublishedContext = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    await expect(unpublishedContext.service.communicationsWorkflow.recordDelivery({
      id: 'del-unpublished',
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      channel: MessageDeliveryChannel.Email,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    const crossSchoolContext = createCommunicationsContext()
    ;(crossSchoolContext.mockRepos as any).students.findById = mock(async () => ({ id: 'stu1', schoolId: 'other-school' }))

    await expect(crossSchoolContext.service.communicationsWorkflow.recordDelivery({
      id: 'del-cross-school',
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      channel: MessageDeliveryChannel.Email,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('recordDelivery matches guardians through class-group announcement targets', async () => {
    const { service } = createCommunicationsContext({
      targets: [{ id: 'target-class', announcementId: 'ann1', targetKind: TargetKind.ClassGroup, targetId: 'cg1' }],
    })

    const result = await service.communicationsWorkflow.recordDelivery({
      id: 'del-guardian-class',
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'gua1',
      channel: MessageDeliveryChannel.Sms,
    })

    expect(result.recipientKind).toBe(MessageDeliveryRecipientKind.Guardian)
    expect(result.recipientId).toBe('gua1')
  })

  test('materializeDeliveries expands targets, reuses existing deliveries, and saves missing deliveries', async () => {
    const existing = new MessageDelivery({
      id: 'existing-delivery',
      announcementId: 'ann1',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'gua1',
      channel: MessageDeliveryChannel.Email,
    })
    const { mockAtomic, mockRepos, service } = createCommunicationsContext({ existingDelivery: existing })

    const result = await service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
      channel: MessageDeliveryChannel.Email,
      createdAt: new Date('2026-05-02T00:00:00Z'),
    })

    expect(result.map(delivery => delivery.id)).toEqual([
      'existing-delivery',
      'generated:ann1:email:staff:staff1',
      'generated:ann1:email:student:stu1',
    ])
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledTimes(2)
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'generated:ann1:email:staff:staff1',
    }))
    expect(mockRepos.messageDeliveries.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'generated:ann1:email:student:stu1',
    }))
  })

  test('materializeDeliveries rejects unpublished announcements', async () => {
    const { service } = createCommunicationsContext({
      announcementStatus: AnnouncementStatus.Draft,
    })

    await expect(service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
      channel: MessageDeliveryChannel.Email,
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
      channel: MessageDeliveryChannel.App,
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
      channel: MessageDeliveryChannel.Email,
    })).rejects.toBeInstanceOf(AuthorizationError)

    const crossSchoolLinkedGuardian = createCommunicationsContext({
      targets: [{ id: 'target-class', announcementId: 'ann1', targetKind: TargetKind.ClassGroup, targetId: 'cg1' }],
    })
    ;(crossSchoolLinkedGuardian.mockRepos as any).guardians.findById = mock(async () => ({ id: 'gua1', schoolId: 'other-school' }))

    await expect(crossSchoolLinkedGuardian.service.communicationsWorkflow.materializeDeliveries({
      announcementId: 'ann1',
      channel: MessageDeliveryChannel.Email,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
