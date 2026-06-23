import { describe, expect, mock, test } from 'bun:test'
import { createRepositoryAuthorizationPolicy } from '../../src/authorization'
import { runCronJobs } from '../../src/cron/cron-job-runner'
import { AssessmentKind } from '../../src/domains'
import { RecordingNotificationGateway } from '../../src/notifications'
import { SchoolApplication } from '../../src/services'

describe('runCronJobs', () => {
  test('processDueNotifications scans assessments and enqueues due-soon jobs per school', async () => {
    const gateway = new RecordingNotificationGateway()
    const asOf = new Date('2026-06-17T12:00:00.000Z')
    const dueAt = new Date('2026-06-20T00:00:00.000Z')

    const repositories = {
      schools: {
        list: mock(async () => [{ id: 'school-1' }]),
      },
      assessments: {
        list: mock(async () => [{
          id: 'assessment-1',
          classGroupId: 'cg1',
          classSubjectId: 'cs1',
          periodId: 'period1',
          title: 'Midterm',
          kind: AssessmentKind.Quiz,
          maxScore: 20,
          coefficient: 1,
          dueAt,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        }]),
      },
      homeworkAssignments: {
        list: mock(async () => []),
      },
      activities: {
        list: mock(async () => []),
      },
      calendarEvents: {
        list: mock(async () => []),
      },
      classGroups: {
        findById: mock(async () => ({ id: 'cg1', schoolId: 'school-1', academicYearId: 'ay1' })),
      },
      enrollments: {
        list: mock(async () => [{ studentId: 'student-1', classGroupId: 'cg1', status: 'active' }]),
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

    const summary = await runCronJobs(application, {
      asOf,
      jobKeys: ['processDueNotifications'],
      requestIdPrefix: 'test-cron',
    })

    expect(summary.results).toHaveLength(1)
    expect(summary.results[0]).toMatchObject({
      schoolId: 'school-1',
      jobKey: 'processDueNotifications',
      result: { processed: 1, skipped: 0 },
    })
    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]?.idempotencyKey).toBe('assessment.due_soon:assessment-1')
  })
})
