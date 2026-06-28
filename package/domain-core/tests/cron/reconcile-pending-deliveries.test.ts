import { describe, expect, mock, test } from 'bun:test'
import { createRepositoryAuthorizationPolicy } from '../../src/authorization'
import { reconcilePendingDeliveries } from '../../src/cron/jobs/reconcile-pending-deliveries'
import { MessageDelivery, MessageDeliveryStatus } from '../../src/domains'
import { noOpNotificationGateway, RecordingNotificationGateway } from '../../src/notifications'
import { SchoolApplication } from '../../src/services'
import { testFileStorage } from '../support/test-file-storage'

describe('reconcilePendingDeliveries', () => {
  test('applies provider status for pending deliveries', async () => {
    const delivery = new MessageDelivery({
      id: 'delivery:ann-1:sub-1',
      schoolId: 'school-1',
      announcementId: 'ann-1',
      subjectId: 'sub-1',
      title: 'Announcement',
      body: 'Content',
      status: MessageDeliveryStatus.Pending,
    })

    const gateway = new RecordingNotificationGateway()
    gateway.setStatusLookup('delivery:ann-1:sub-1', {
      status: 'sent',
      providerMessageId: 'msg-novu-1',
      occurredAt: new Date('2026-06-24T00:00:00.000Z'),
    })

    const repositories = {
      schools: { list: mock(async () => [{ id: 'school-1' }]) },
      announcements: {
        list: mock(async () => [{ id: 'ann-1', schoolId: 'school-1' }]),
        findById: mock(async () => ({ id: 'ann-1', schoolId: 'school-1' })),
      },
      messageDeliveries: {
        list: mock(async (options?: { status?: string, schoolId?: string }) => (
          options?.status === MessageDeliveryStatus.Pending ? [delivery] : []
        )),
        findById: mock(async (id: string) => (id === delivery.id ? delivery : undefined)),
        save: mock(async (entity: MessageDelivery) => entity),
      },
      staffAssignments: {},
      staffMembers: {},
      guardians: {},
      guardianLinks: {},
      students: {},
    } as any

    const application = new SchoolApplication({
      atomicExecution: { execute: async operation => operation() },
      notificationGateway: gateway,
      fileStorage: testFileStorage,
      repositories,
      authorizationPolicy: createRepositoryAuthorizationPolicy({
        repositories,
        staffAssignmentRepository: repositories.staffAssignments,
        staffMemberRepository: repositories.staffMembers,
        guardianRepository: repositories.guardians,
        guardianStudentLinkRepository: repositories.guardianLinks,
        studentRepository: repositories.students,
      }),
    })

    const actor = {
      kind: 'system' as const,
      systemId: 'cron',
      schoolId: 'school-1',
      requestId: 'cron:test',
      reason: 'test',
    }

    const result = await reconcilePendingDeliveries({
      asOf: new Date('2026-06-24T00:05:00.000Z'),
      actor,
      service: application.forActor(actor),
    })

    expect(result).toEqual({ processed: 1, skipped: 0 })
    expect(gateway.statusLookups).toEqual([[{
      deliveryId: 'delivery:ann-1:sub-1',
      subjectId: 'sub-1',
    }]])
    expect(repositories.messageDeliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MessageDeliveryStatus.Sent,
        providerMessageId: 'msg-novu-1',
      }),
    )
  })

  test('skips deliveries when gateway has no lookup implementation', async () => {
    const repositories = {
      schools: { list: mock(async () => [{ id: 'school-1' }]) },
      announcements: {
        list: mock(async () => [{ id: 'ann-1', schoolId: 'school-1' }]),
      },
      messageDeliveries: {
        list: mock(async (options?: { status?: string, schoolId?: string }) => (
          options?.status === MessageDeliveryStatus.Pending
            ? [new MessageDelivery({
                id: 'delivery:ann-1:sub-1',
                schoolId: 'school-1',
                announcementId: 'ann-1',
                subjectId: 'sub-1',
                title: 'Announcement',
                body: 'Content',
                status: MessageDeliveryStatus.Pending,
              })]
            : []
        )),
      },
      staffAssignments: {},
      staffMembers: {},
      guardians: {},
      guardianLinks: {},
      students: {},
    } as any

    const application = new SchoolApplication({
      atomicExecution: { execute: async operation => operation() },
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
      repositories,
      authorizationPolicy: createRepositoryAuthorizationPolicy({
        repositories,
        staffAssignmentRepository: repositories.staffAssignments,
        staffMemberRepository: repositories.staffMembers,
        guardianRepository: repositories.guardians,
        guardianStudentLinkRepository: repositories.guardianLinks,
        studentRepository: repositories.students,
      }),
    })

    const actor = {
      kind: 'system' as const,
      systemId: 'cron',
      schoolId: 'school-1',
      requestId: 'cron:test',
      reason: 'test',
    }

    const result = await reconcilePendingDeliveries({
      asOf: new Date('2026-06-24T00:05:00.000Z'),
      actor,
      service: application.forActor(actor),
    })

    expect(result).toEqual({ processed: 0, skipped: 1 })
  })
})
