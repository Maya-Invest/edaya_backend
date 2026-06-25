import type { ActorMetadata } from '../../src/authorization'
import type { Assessment } from '../../src/domains'
import { describe, expect, test } from 'bun:test'
import { AssessmentKind, MessageDeliveryRecipientKind, StudentClassEnrollmentStatus } from '../../src/domains'
import {
  assessmentDueSoonDeliverAfter,
  assessmentDueSoonIdempotencyKey,
  assessmentDueSoonPredicate,
  assessmentDueSoonTrigger,
  notificationTriggerRegistry,
  RecordingNotificationGateway,
  registerNotificationTriggers,
  withNotificationPostSaveHook,
} from '../../src/notifications'
import { NotificationTemplateService } from '../../src/notifications/templates/notification-template-service'

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
    sessionId: overrides.sessionId,
    dueAt: overrides.dueAt,
    metAt: overrides.metAt,
    date: overrides.date,
    createdAt: overrides.createdAt ?? new Date('2026-06-01T00:00:00Z'),
  } as Assessment
}

describe('assessmentDueSoonPredicate', () => {
  const dueAt = new Date('2026-06-20T00:00:00Z')

  test('fires when a new assessment is created with dueAt', () => {
    expect(assessmentDueSoonPredicate(assessment({ id: 'a1', dueAt }), undefined)).toBe(true)
  })

  test('does not fire on no-op save with unchanged dueAt', () => {
    const entity = assessment({ id: 'a1', dueAt })
    expect(assessmentDueSoonPredicate(entity, entity)).toBe(false)
  })

  test('fires when dueAt changes', () => {
    const existing = assessment({ id: 'a1', dueAt })
    const updated = assessment({ id: 'a1', dueAt: new Date('2026-06-25T00:00:00Z') })
    expect(assessmentDueSoonPredicate(updated, existing)).toBe(true)
  })

  test('fires when dueAt is removed', () => {
    const existing = assessment({ id: 'a1', dueAt })
    const updated = assessment({ id: 'a1' })
    expect(assessmentDueSoonPredicate(updated, existing)).toBe(true)
  })

  test('fires when assessment is marked complete', () => {
    const existing = assessment({ id: 'a1', dueAt })
    const updated = assessment({ id: 'a1', dueAt, metAt: new Date('2026-06-18T00:00:00Z') })
    expect(assessmentDueSoonPredicate(updated, existing)).toBe(true)
  })
})

describe('assessmentDueSoonTrigger resolver', () => {
  const actor = { schoolId: 'school-1' } as ActorMetadata
  const dueAt = new Date('2026-06-20T00:00:00Z')

  test('enqueues a job notification for active class students', async () => {
    const gateway = new RecordingNotificationGateway()
    const entity = assessment({ id: 'a1', dueAt, title: 'Midterm' })

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
    const entity = assessment({ id: 'a1', dueAt })

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

  test('cancels scheduled notification when assessment is completed', async () => {
    const gateway = new RecordingNotificationGateway()
    const existing = assessment({ id: 'a1', dueAt })
    const completed = assessment({ id: 'a1', dueAt, metAt: new Date('2026-06-18T00:00:00Z') })

    const input = await assessmentDueSoonTrigger.resolver(completed, existing, {
      notificationGateway: gateway,
      templateService: createTestTemplateService(),
      actor,
      repositories: {
        classGroups: { findById: async () => ({ id: 'cg1', schoolId: 'school-1' }) },
        schools: { findById: async () => ({ id: 'school-1', name: 'Test School' }) },
        enrollments: { list: async () => [] },
      } as any,
    })

    expect(input).toBeNull()
    expect(gateway.cancelled).toEqual([assessmentDueSoonIdempotencyKey('a1')])
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
          read: {
            checkModule: async () => {},
            checkAccess: async () => {},
          },
          write: {
            checkModule: async () => {},
            authorizeSave: async () => {},
            authorizeDelete: async () => {},
          },
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
        assessment({ id: 'a1', dueAt: new Date('2026-06-20T00:00:00Z') }),
        undefined,
        {
          classGroups: {
            findById: async () => ({ id: 'cg1', schoolId: 'school-1' }),
          },
          enrollments: {
            list: async () => [],
          },
        } as any,
        { schoolId: 'school-1' } as ActorMetadata,
      )

      expect(existingPostSaveCalled).toBe(true)
      expect(gateway.enqueued).toHaveLength(1)
    }
    finally {
      notificationTriggerRegistry.clear()
      registerNotificationTriggers()
    }
  })
})
