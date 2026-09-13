import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { Assessment } from '@edaya/core'
import { createSystemActorMetadata } from '@edaya/authorization'
import { AssessmentKind, MessageDelivery, MessageDeliveryRecipientKind, RecordingNotificationGateway, StudentClassEnrollmentStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'
import {
  assessmentDueSoonDeliverAfter,
  assessmentDueSoonIdempotencyKey,
  assessmentDueSoonPredicate,
  assessmentDueSoonTrigger,
  notificationTriggerRegistry,
  registerNotificationTriggers,
  withNotificationPostSaveHook,
} from '../../src/capabilities/notifications'
import { NotificationTemplateService } from '../../src/capabilities/notifications/templates/notification-template-service'

function createTestTemplateService(): NotificationTemplateService {
  return new NotificationTemplateService({
    schoolNotificationTemplates: {
      findById: async () => undefined,
    },
  } as any)
}

function assessment(overrides: Partial<Assessment['data']> & Pick<Assessment['data'], 'id'>): Assessment {
  return {
    id: overrides.id,
    classGroupId: overrides.classGroupId ?? 'cg1',
    classSubjectId: overrides.classSubjectId ?? 'cs1',
    periodId: overrides.periodId ?? 'period1',
    title: overrides.title ?? 'Quiz 1',
    kind: overrides.kind ?? AssessmentKind.Quiz,
    maxScore: overrides.maxScore ?? 20,
    coefficient: overrides.coefficient ?? 1,
    lessonSessionId: overrides.lessonSessionId,
    startsAt: overrides.startsAt,
    endsAt: overrides.endsAt,
    dueAt: overrides.dueAt,
    completedAt: overrides.completedAt,
    createdAt: overrides.createdAt ?? new Date('2026-06-01T00:00:00Z'),
  } as Assessment
}

describe('assessmentDueSoonPredicate', () => {
  const dueAt = new Date('2026-06-20T00:00:00Z')
  const homework = { kind: AssessmentKind.Homework } as const

  test('fires when a new assessment is created with dueAt', () => {
    expect(assessmentDueSoonPredicate(assessment({ id: 'a1', dueAt, ...homework }), undefined)).toBe(true)
  })

  test('does not fire on no-op save with unchanged dueAt', () => {
    const entity = assessment({ id: 'a1', dueAt, ...homework })
    expect(assessmentDueSoonPredicate(entity, entity)).toBe(false)
  })

  test('fires when dueAt changes', () => {
    const existing = assessment({ id: 'a1', dueAt, ...homework })
    const updated = assessment({ id: 'a1', dueAt: new Date('2026-06-25T00:00:00Z'), ...homework })
    expect(assessmentDueSoonPredicate(updated, existing)).toBe(true)
  })

  test('fires when dueAt is removed', () => {
    const existing = assessment({ id: 'a1', dueAt, ...homework })
    const updated = assessment({ id: 'a1', kind: AssessmentKind.Quiz, startsAt: new Date('2026-06-20T09:00:00.000Z'), endsAt: new Date('2026-06-20T10:00:00.000Z') })
    expect(assessmentDueSoonPredicate(updated, existing)).toBe(true)
  })

  test('fires when assessment is marked complete', () => {
    const existing = assessment({ id: 'a1', dueAt, ...homework })
    const updated = assessment({ id: 'a1', dueAt, completedAt: new Date('2026-06-18T00:00:00Z'), ...homework })
    expect(assessmentDueSoonPredicate(updated, existing)).toBe(true)
  })
})

describe('assessmentDueSoonTrigger resolver', () => {
  const actor = { schoolId: 'school-1' } as SchoolScopedActorMetadata
  const dueAt = new Date('2026-06-20T00:00:00Z')

  test('enqueues a job notification for active class students', async () => {
    const gateway = new RecordingNotificationGateway()
    const entity = assessment({ id: 'a1', dueAt, title: 'Midterm', kind: AssessmentKind.Homework })

    const input = await assessmentDueSoonTrigger.resolver(entity, undefined, {
      notificationGateway: gateway,
      templateService: createTestTemplateService(),
      actor,
      repositories: {
        classGroups: {
          findById: async () => ({ id: 'cg1', schoolId: 'school-1' }),
        },
        schools: {
          findById: async () => ({ id: 'school-1', name: 'Test School' }),
        },
        enrollments: {
          list: async () => [
            { studentId: 's1', status: StudentClassEnrollmentStatus.Active },
            { studentId: 's2', status: StudentClassEnrollmentStatus.Active },
          ],
        },
      } as any,
    })

    expect(input).toMatchObject({
      idempotencyKey: assessmentDueSoonIdempotencyKey('a1'),
      schoolId: 'school-1',
      kind: 'job',
      eventKey: 'assessment.due_soon',
      recipients: [
        { kind: MessageDeliveryRecipientKind.Student, id: 's1' },
        { kind: MessageDeliveryRecipientKind.Student, id: 's2' },
      ],
      deliverAfter: assessmentDueSoonDeliverAfter(dueAt),
    })
  })

  test('skips enqueue when class group school does not match actor tenant', async () => {
    const gateway = new RecordingNotificationGateway()
    const entity = assessment({ id: 'a1', dueAt, kind: AssessmentKind.Homework })

    const input = await assessmentDueSoonTrigger.resolver(entity, undefined, {
      notificationGateway: gateway,
      templateService: createTestTemplateService(),
      actor,
      repositories: {
        classGroups: {
          findById: async () => ({ id: 'cg1', schoolId: 'other-school' }),
        },
        schools: {
          findById: async () => undefined,
        },
        enrollments: {
          list: async () => [],
        },
      } as any,
    })

    expect(input).toBeNull()
    expect(gateway.enqueued).toHaveLength(0)
  })

  test.each(['completed', 'quiz'])('cancels persisted notifications after %s even when the student has left', async (change) => {
    const fixture = await createAuthorizationDatabase()
    try {
      await seedAuthorizationRelationships(fixture.db)
      await fixture.repositories.messageDeliveries.save(new MessageDelivery({
        id: 'original-provider-id',
        schoolId: 'school-a',
        sourceKey: assessmentDueSoonIdempotencyKey('a1'),
        eventKey: 'assessment.due_soon',
        subjectId: 'former-login',
        recipientKind: MessageDeliveryRecipientKind.Student,
        recipientId: 'student-a',
        title: 'Reminder',
        body: 'Homework due',
      }))
      await fixture.repositories.enrollments.delete('enrollment-a')
      const gateway = new RecordingNotificationGateway()
      const existing = assessment({ id: 'a1', classGroupId: 'class-a', dueAt, kind: AssessmentKind.Homework })
      const updated = assessment({ id: 'a1', classGroupId: 'class-a', dueAt: change === 'quiz' ? undefined : dueAt, completedAt: change === 'completed' ? new Date('2026-06-18') : undefined, kind: change === 'quiz' ? AssessmentKind.Quiz : AssessmentKind.Homework })
      const input = await assessmentDueSoonTrigger.resolver(updated, existing, {
        notificationGateway: gateway,
        templateService: new NotificationTemplateService(fixture.repositories),
        actor: createSystemActorMetadata({ schoolId: 'school-a', systemId: 'processDueNotifications', requestId: 'test', reason: 'Test' }),
        repositories: fixture.repositories,
      })
      expect(input).toBeNull()
      expect(gateway.cancelled).toEqual(['original-provider-id'])
    }
    finally { await fixture.db.close() }
  })
})

describe('withNotificationPostSaveHook', () => {
  test('chains existing postSave with notification hook', async () => {
    const gateway = new RecordingNotificationGateway()
    let existingPostSaveCalled = false

    notificationTriggerRegistry.register({
      entityKey: 'assessments',
      predicate: () => true,
      resolver: async () => ({
        idempotencyKey: 'test:1',
        schoolId: 'school-1',
        kind: 'event',
        eventKey: 'test.event',
        title: 'Test',
        body: 'Body',
        recipients: [],
      }),
    })

    try {
      const config = withNotificationPostSaveHook(
        'assessments',
        {
          repository: {} as any,
          tenant: { resolve: async () => 'school-1' },
          resource: 'assessments',
          hooks: {
            postSave: async () => {
              existingPostSaveCalled = true
            },
          },
        },
        gateway,
        createTestTemplateService(),
      )

      await config.hooks?.postSave?.(
        assessment({ id: 'a1', dueAt: new Date('2026-06-20T00:00:00Z'), kind: AssessmentKind.Homework }),
        undefined,
        {
          classGroups: {
            findById: async () => ({ id: 'cg1', schoolId: 'school-1' }),
          },
          enrollments: {
            list: async () => [],
          },
        } as any,
        { schoolId: 'school-1' } as SchoolScopedActorMetadata,
      )

      expect(existingPostSaveCalled).toBe(true)
      expect(gateway.enqueued).toHaveLength(0)
    }
    finally {
      notificationTriggerRegistry.clear()
      registerNotificationTriggers()
    }
  })
})
