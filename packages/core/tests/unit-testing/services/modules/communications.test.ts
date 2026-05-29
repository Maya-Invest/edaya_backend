import type { AtomicExecutionPort } from '../../../../src/ports/atomic-execution'
import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import type { ActorMetadata } from '../../../../src/services/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { Announcement, AnnouncementStatus } from '../../../../src/entities/messaging/announcement'
import { AnnouncementTargetKind as TargetKind } from '../../../../src/entities/messaging/announcement-target'
import { MessageDeliveryChannel, MessageDeliveryRecipientKind, MessageDeliveryStatus } from '../../../../src/entities/messaging/message-delivery'
import { CommunicationsService } from '../../../../src/services/commands/communications'

describe('CommunicationsService', () => {
  const mockRepos = {
    announcements: {
      findById: mock(async id => new Announcement({
        id,
        schoolId: 'sch1',
        status: id.startsWith('pub') ? AnnouncementStatus.Published : AnnouncementStatus.Draft,
        title: 'T',
        content: 'C',
        createdBy: 'u1',
        publishedAt: id.startsWith('pub') ? new Date(Date.now() - 10000) : undefined,
      })),
      save: mock(async () => {}),
    },
    announcementTargets: {
      list: mock(async ({ announcementId }: any = {}) => {
        if (announcementId === 'pub_school')
          return [{ id: 't4', announcementId: 'pub_school', targetKind: TargetKind.School, targetId: 'sch1' }]
        if (announcementId === 'pub_class')
          return [{ id: 't3', announcementId: 'pub_class', targetKind: TargetKind.ClassGroup, targetId: 'cg1' }]
        if (announcementId === 'pub_grade')
          return [{ id: 't5', announcementId: 'pub_grade', targetKind: TargetKind.GradeLevel, targetId: 'gl1' }]
        return [
          { id: 't1', announcementId: 'pub', targetKind: TargetKind.AllStudents },
          { id: 't2', announcementId: 'pub', targetKind: TargetKind.StaffMember, targetId: 'staff1' },
          { id: 't3', announcementId: 'pub', targetKind: TargetKind.ClassGroup, targetId: 'cg1' },
          { id: 't5', announcementId: 'pub', targetKind: TargetKind.GradeLevel, targetId: 'gl1' },
        ]
      }),
      save: mock(async () => {}),
    },
    messageDeliveries: {
      save: mock(async () => {}),
      list: mock(async () => []),
    },
    students: { findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1' })), list: mock(async () => [{ id: 'stu1', schoolId: 'sch1' }]) },
    staffMembers: { findById: mock(async () => ({ id: 'staff1', schoolId: 'sch1' })), list: mock(async () => [{ id: 'staff1', schoolId: 'sch1' }]) },
    guardians: { findById: mock(async () => ({ id: 'gua1', schoolId: 'sch1' })), list: mock(async () => [{ id: 'gua1', schoolId: 'sch1' }]) },
    classGroups: { findById: mock(async () => ({ id: 'cg1', schoolId: 'sch1', gradeLevelId: 'gl1' })), list: mock(async () => [{ id: 'cg1', schoolId: 'sch1' }]) },
    gradeLevels: { findById: mock(async () => ({ id: 'gl1', schoolId: 'sch1' })), list: mock(async () => [{ id: 'gl1', schoolId: 'sch1' }]) },
    enrollments: { list: mock(async () => [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: 'Active' }]) },
    guardianLinks: { list: mock(async () => [{ studentId: 'stu1', guardianId: 'gua1' }]) },
  } as unknown as SchoolRepositories

  const mockPolicy = { requirePermission: mock(async () => {}) } as unknown as AuthorizationPolicy
  const mockAtomic: AtomicExecutionPort = { execute: mock(async (op: () => Promise<any>) => op()) }
  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'sch1',
    requestId: 'req1',
    reason: 'test',
  }

  const service = new CommunicationsService({ repositories: mockRepos, authorizationPolicy: mockPolicy, actor, atomicExecution: mockAtomic } as any)

  test('recordDelivery throws if unpublished', async () => {
    expect(
      service.recordDelivery({
        id: 'del1',
        announcementId: 'draft',
        recipientKind: MessageDeliveryRecipientKind.Student,
        recipientId: 'stu1',
        channel: MessageDeliveryChannel.Email,
      }),
    ).rejects.toThrow('must be published')
  })

  test('recordDelivery throws if recipient not eligible', async () => {
    expect(
      service.recordDelivery({
        id: 'del1',
        announcementId: 'pub',
        recipientKind: MessageDeliveryRecipientKind.Staff,
        recipientId: 'other_staff',
        channel: MessageDeliveryChannel.Email,
      }),
    ).rejects.toThrow('not eligible')
  })

  test('recordDelivery succeeds if eligible', async () => {
    const res = await service.recordDelivery({
      id: 'del1',
      announcementId: 'pub',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      channel: MessageDeliveryChannel.Email,
      status: MessageDeliveryStatus.Sent,
      sentAt: new Date(),
    })
    expect(res.id).toBe('del1')

    const res2 = await service.recordDelivery({
      id: 'del2',
      announcementId: 'pub_class',
      recipientKind: MessageDeliveryRecipientKind.Student,
      recipientId: 'stu1',
      channel: MessageDeliveryChannel.Email,
    })
    expect(res2.id).toBe('del2')

    const res3 = await service.recordDelivery({
      id: 'del3',
      announcementId: 'pub_grade',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'gua1',
      channel: MessageDeliveryChannel.Email,
    })
    expect(res3.id).toBe('del3')
  })

  test('materializeDeliveries throws if unpublished', async () => {
    expect(
      service.materializeDeliveries({
        announcementId: 'draft',
        channel: MessageDeliveryChannel.Email,
      }),
    ).rejects.toThrow('must be published')
  })

  test('materializeDeliveries succeeds for published', async () => {
    await service.materializeDeliveries({
      announcementId: 'pub',
      channel: MessageDeliveryChannel.Email,
    })
    const deliveries = await service.materializeDeliveries({
      announcementId: 'pub_school',
      channel: MessageDeliveryChannel.Email,
    })
    expect(deliveries.length).toBeGreaterThan(0)
  })
})
