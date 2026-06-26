import type { HomeworkAssignment } from '../../src/domains'
import type { SchoolRepositories } from '../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import { createStaffActorMetadata } from '../../src/authorization'
import { HomeworkAssignmentType } from '../../src/domains'
import {
  RecordingNotificationGateway,
  withNotificationPostSaveHook,
} from '../../src/notifications'
import { NotificationTemplateService } from '../../src/notifications/templates/notification-template-service'
import { ManagedEntityService } from '../../src/services/managed-entity-service'
import { createRepository } from '../services/managed-entities/managed-entity-test-context'
import { effectiveGrantsForRoles } from '../support/effective-grants'

function createHomework(overrides: Partial<HomeworkAssignment['data']> = {}): HomeworkAssignment {
  return {
    id: overrides.id ?? 'homework-1',
    schoolId: overrides.schoolId ?? 'school-1',
    classGroupId: overrides.classGroupId ?? 'cg1',
    classSubjectId: overrides.classSubjectId ?? 'cs1',
    title: overrides.title ?? 'Chapter 5 exercises',
    description: overrides.description ?? 'Complete exercises 1-10',
    dueDate: overrides.dueDate ?? new Date('2026-06-20T00:00:00.000Z'),
    assignedDate: overrides.assignedDate ?? new Date('2026-06-10T00:00:00.000Z'),
    type: overrides.type ?? HomeworkAssignmentType.Homework,
    attachments: overrides.attachments ?? [],
    createdAt: overrides.createdAt ?? new Date('2026-06-01T00:00:00.000Z'),
  } as HomeworkAssignment
}

describe('homework notification postSave hook', () => {
  const actor = createStaffActorMetadata({
    subjectId: 'staff-user',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    effectiveGrants: effectiveGrantsForRoles(['admin']),
    requestId: 'test',
    authenticatedAt: new Date('2026-06-01T00:00:00.000Z'),
  })

  function createHomeworkService(gateway: RecordingNotificationGateway, repository = createRepository<HomeworkAssignment>()) {
    const repositories = {
      schools: {
        findById: mock(async () => ({ id: 'school-1', name: 'Test School' })),
      },
      enrollments: {
        list: mock(async () => [{ studentId: 'student-1', classGroupId: 'cg1', status: 'active' }]),
      },
      students: {
        findById: mock(async () => ({
          id: 'student-1',
          schoolId: 'school-1',
          subjectId: 'auth-student-1',
        })),
      },
      guardianLinks: {
        list: mock(async () => [{
          guardianId: 'guardian-1',
          studentId: 'student-1',
          schoolId: 'school-1',
          receivesAcademicReports: true,
        }]),
      },
      guardians: {
        findById: mock(async () => ({
          id: 'guardian-1',
          schoolId: 'school-1',
          subjectId: 'auth-guardian-1',
          contactMethods: [{ allowsNotifications: true }],
        })),
      },
      messageDeliveries: {
        findById: mock(async () => undefined),
        save: mock(async () => {}),
      },
    } as unknown as SchoolRepositories

    const service = new ManagedEntityService<HomeworkAssignment>({
      actor,
      repositories,
      config: withNotificationPostSaveHook('homeworkAssignments', {
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

  test('enqueues due-soon job after save when dueDate is set', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createHomeworkService(gateway)

    await service.save(createHomework())

    expect(gateway.enqueued).toHaveLength(2)
    expect(gateway.enqueued.map(entry => entry.idempotencyKey)).toEqual([
      'delivery:homework.due_soon:homework-1:auth-student-1',
      'delivery:homework.due_soon:homework-1:auth-guardian-1',
    ])
  })

  test('does not enqueue on no-op save with unchanged dueDate', async () => {
    const gateway = new RecordingNotificationGateway()
    const existing = createHomework()
    const repository = createRepository<HomeworkAssignment>()
    await repository.save(existing)
    const { service } = createHomeworkService(gateway, repository)

    await service.save(existing)

    expect(gateway.enqueued).toHaveLength(0)
  })
})
