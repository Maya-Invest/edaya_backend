import type { Assessment } from '../../src/domains'
import type { SchoolRepositories } from '../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import { createStaffActorMetadata } from '../../src/authorization'
import { AssessmentKind, MessageDeliveryRecipientKind } from '../../src/domains'
import {
  assessmentDueSoonIdempotencyKey,
  RecordingNotificationGateway,
  withNotificationPostSaveHook,
} from '../../src/notifications'
import { NotificationTemplateService } from '../../src/notifications/templates/notification-template-service'
import { ManagedEntityService } from '../../src/services/managed-entity-service'
import { createRepository } from '../services/managed-entities/managed-entity-test-context'
import { effectiveGrantsForRoles } from '../support/effective-grants'

function createAssessment(overrides: Partial<Assessment['data']> = {}): Assessment {
  return {
    id: overrides.id ?? 'assessment-1',
    classGroupId: overrides.classGroupId ?? 'cg1',
    classSubjectId: overrides.classSubjectId ?? 'cs1',
    periodId: overrides.periodId ?? 'period1',
    title: overrides.title ?? 'Quiz 1',
    kind: overrides.kind ?? AssessmentKind.Quiz,
    maxScore: overrides.maxScore ?? 20,
    coefficient: overrides.coefficient ?? 1,
    dueAt: overrides.dueAt,
    metAt: overrides.metAt,
    createdAt: overrides.createdAt ?? new Date('2026-06-01T00:00:00Z'),
  } as Assessment
}

describe('assessment notification postSave hook', () => {
  const actor = createStaffActorMetadata({
    subjectId: 'staff-user',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    effectiveGrants: effectiveGrantsForRoles(['admin']),
    requestId: 'test',
    authenticatedAt: new Date('2026-06-01T00:00:00Z'),
  })

  function createAssessmentService(gateway: RecordingNotificationGateway, repository = createRepository<Assessment>()) {
    const repositories = {
      classGroups: {
        findById: mock(async () => ({ id: 'cg1', schoolId: 'school-1', academicYearId: 'ay1' })),
      },
      schools: {
        findById: mock(async () => ({ id: 'school-1', name: 'Test School' })),
      },
      enrollments: {
        list: mock(async () => [{ studentId: 'student-1', classGroupId: 'cg1' }]),
      },
      students: {
        findById: mock(async (id: string) => ({ id, schoolId: 'school-1', subjectId: `subject-${id}` })),
      },
      messageDeliveries: {
        findById: mock(async () => undefined),
        save: mock(async () => {}),
      },
    } as unknown as SchoolRepositories

    const service = new ManagedEntityService<Assessment>({
      actor,
      repositories,
      config: withNotificationPostSaveHook('assessments', {
        repository,
        tenant: { resolve: async () => 'school-1' },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      }, gateway, new NotificationTemplateService({
        schoolNotificationTemplates: { findById: async () => undefined },
      } as any)),
    })

    return { service, repository }
  }

  test('enqueues due-soon job after repository save on dueAt transition', async () => {
    const gateway = new RecordingNotificationGateway()
    const dueAt = new Date('2026-06-20T00:00:00Z')
    const { service } = createAssessmentService(gateway)

    await service.save(createAssessment({ dueAt }))

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]?.idempotencyKey).toBe('delivery:assessment.due_soon:assessment-1:subject-student-1')
    expect(gateway.enqueued[0]?.recipients).toEqual([
      { kind: MessageDeliveryRecipientKind.Student, id: 'student-1', subjectId: 'subject-student-1' },
    ])
  })

  test('does not enqueue on no-op save with unchanged dueAt', async () => {
    const gateway = new RecordingNotificationGateway()
    const dueAt = new Date('2026-06-20T00:00:00Z')
    const existing = createAssessment({ dueAt })
    const repository = createRepository<Assessment>()
    await repository.save(existing)
    const { service } = createAssessmentService(gateway, repository)

    await service.save(existing)

    expect(gateway.enqueued).toHaveLength(0)
  })
})
