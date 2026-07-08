import { AuthorizationError } from '@edaya/authorization'
import { ActivityEnrollment, ActivityEnrollmentStatus } from '@edaya/core'
import { validateActivityEnrollmentSave } from '@edaya/school-service'
import { describe, expect, mock, test } from 'bun:test'

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    activities: {
      findById: mock(async () => ({ id: 'activity-1', schoolId: 'school-1' })),
    },
    students: {
      findById: mock(async () => ({ id: 'student-1', schoolId: 'school-1' })),
    },
    ...overrides,
  } as never
}

describe('validateActivityEnrollmentSave', () => {
  test('accepts enrollments for students in the same school as the activity', async () => {
    await validateActivityEnrollmentSave(new ActivityEnrollment({
      id: 'enr-1',
      activityId: 'activity-1',
      studentId: 'student-1',
      status: ActivityEnrollmentStatus.Pending,
    }), undefined, repositories())
  })

  test('rejects cross-school activity and student pairings', async () => {
    await expect(validateActivityEnrollmentSave(new ActivityEnrollment({
      id: 'enr-1',
      activityId: 'activity-1',
      studentId: 'student-1',
      status: ActivityEnrollmentStatus.Approved,
    }), undefined, repositories({
      students: {
        findById: mock(async () => ({ id: 'student-1', schoolId: 'other-school' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })
})
