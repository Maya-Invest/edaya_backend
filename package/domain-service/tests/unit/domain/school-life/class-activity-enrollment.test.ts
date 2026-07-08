import { AuthorizationError } from '@edaya/authorization'
import { BusinessRuleViolationError, ClassActivityEnrollment, DayOfWeek, isActivityAvailableForClassGroup, Schedule, ScheduleKind } from '@edaya/core'
import { validateClassActivityEnrollmentSave, validateScheduleSave } from '@edaya/service'
import { describe, expect, mock, test } from 'bun:test'

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    activities: {
      findById: mock(async () => ({ id: 'activity-1', schoolId: 'school' })),
    },
    classGroups: {
      findById: mock(async () => ({ id: 'class-1', schoolId: 'school', academicYearId: 'year-1' })),
    },
    classActivityEnrollments: {
      list: mock(async () => []),
    },
    classSubjects: {
      findById: mock(async () => undefined),
    },
    ...overrides,
  } as any
}

describe('class activity enrollment', () => {
  test('accepts a valid class activity enrollment', async () => {
    await validateClassActivityEnrollmentSave(new ClassActivityEnrollment({
      id: 'cae-1',
      activityId: 'activity-1',
      classGroupId: 'class-1',
    }), undefined, repositories())
  })

  test('rejects duplicate class activity enrollments', async () => {
    await expect(validateClassActivityEnrollmentSave(new ClassActivityEnrollment({
      id: 'cae-2',
      activityId: 'activity-1',
      classGroupId: 'class-1',
    }), undefined, repositories({
      classActivityEnrollments: {
        list: mock(async () => [{ id: 'cae-1', activityId: 'activity-1', classGroupId: 'class-1' }]),
      },
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('rejects mismatched school ownership', async () => {
    await expect(validateClassActivityEnrollmentSave(new ClassActivityEnrollment({
      id: 'cae-1',
      activityId: 'activity-1',
      classGroupId: 'class-1',
    }), undefined, repositories({
      classGroups: {
        findById: mock(async () => ({ id: 'class-1', schoolId: 'other-school', academicYearId: 'year-1' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('treats activities without class enrollments as school-wide', async () => {
    const available = await isActivityAvailableForClassGroup('activity-1', 'class-1', repositories())
    expect(available).toBe(true)
  })

  test('requires class enrollment when activity is class-scoped', async () => {
    const repos = repositories({
      classActivityEnrollments: {
        list: mock(async () => [{ id: 'cae-1', activityId: 'activity-1', classGroupId: 'class-2' }]),
      },
    })

    await expect(isActivityAvailableForClassGroup('activity-1', 'class-1', repos)).resolves.toBe(false)
    await expect(isActivityAvailableForClassGroup('activity-1', 'class-2', repos)).resolves.toBe(true)
  })

  test('blocks activity schedules for non-enrolled class groups', async () => {
    const repos = repositories({
      classActivityEnrollments: {
        list: mock(async () => [{ id: 'cae-1', activityId: 'activity-1', classGroupId: 'class-2' }]),
      },
    })

    await expect(validateScheduleSave(new Schedule({
      id: 'schedule-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleKind: ScheduleKind.Activity,
      activityId: 'activity-1',
      title: 'Chess club',
      dayOfWeek: DayOfWeek.Monday,
      startTime: '15:00',
      endTime: '16:00',
      isRecurring: true,
    }), undefined, repos)).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})
