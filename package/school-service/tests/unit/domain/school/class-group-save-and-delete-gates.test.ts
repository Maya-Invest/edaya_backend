import type { BusinessRuleViolationError } from '@edaya/core'
import { AuthorizationError } from '@edaya/authorization'
import { ClassGroup } from '@edaya/core'
import { validateClassGroupDelete, validateClassGroupSave } from '@edaya/school-service'
import { describe, expect, mock, test } from 'bun:test'

const classGroup = new ClassGroup({
  id: 'class-1',
  schoolId: 'school-1',
  academicYearId: 'year-1',
  gradeLevelId: 'gl-1',
  name: '10A',
  capacity: 30,
  homeroomStaffId: 'staff-1',
})

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    academicYears: {
      findById: mock(async () => ({ id: 'year-1', schoolId: 'school-1' })),
    },
    gradeLevels: {
      findById: mock(async () => ({ id: 'gl-1', schoolId: 'school-1' })),
    },
    staffMembers: {
      findById: mock(async () => ({ id: 'staff-1', schoolId: 'school-1' })),
    },
    enrollments: {
      count: mock(async () => 2),
      list: mock(async () => []),
    },
    classSubjects: { list: mock(async () => []) },
    classActivityEnrollments: { list: mock(async () => []) },
    lessonSessions: { list: mock(async () => []) },
    attendances: { list: mock(async () => []) },
    schedules: { list: mock(async () => []) },
    assessments: { list: mock(async () => []) },
    incidents: { list: mock(async () => []) },
    resourceAssignments: { list: mock(async () => []) },
    calendarEvents: { list: mock(async () => []) },
    ...overrides,
  } as never
}

describe('validateClassGroupSave', () => {
  test('accepts class groups whose academic year, grade level, and homeroom staff belong to the school', async () => {
    await validateClassGroupSave(classGroup, undefined, repositories())
  })

  test('rejects class groups whose academic year belongs to another school', async () => {
    await expect(validateClassGroupSave(classGroup, undefined, repositories({
      academicYears: {
        findById: mock(async () => ({ id: 'year-1', schoolId: 'other-school' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects class groups whose grade level belongs to another school', async () => {
    await expect(validateClassGroupSave(classGroup, undefined, repositories({
      gradeLevels: {
        findById: mock(async () => ({ id: 'gl-1', schoolId: 'other-school' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects class groups whose homeroom staff belongs to another school', async () => {
    await expect(validateClassGroupSave(classGroup, undefined, repositories({
      staffMembers: {
        findById: mock(async () => ({ id: 'staff-1', schoolId: 'other-school' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects capacity reductions below the active enrollment count', async () => {
    const existing = new ClassGroup({
      id: 'class-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'gl-1',
      name: '10A',
      capacity: 30,
    })

    await expect(validateClassGroupSave(existing.copyWith({ capacity: 1 }), existing, repositories({
      enrollments: {
        count: mock(async () => 5),
        list: mock(async () => []),
      },
    }))).rejects.toMatchObject({
      code: 'CLASS_GROUP_CAPACITY_BELOW_ENROLLMENTS',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})

describe('validateClassGroupDelete', () => {
  test('allows deletion when no dependent records exist', async () => {
    await validateClassGroupDelete(classGroup, repositories())
  })

  test('rejects deletion when enrollments still reference the class group', async () => {
    await expect(validateClassGroupDelete(classGroup, repositories({
      enrollments: {
        count: mock(async () => 0),
        list: mock(async () => [{ id: 'enr-1' }]),
      },
    }))).rejects.toMatchObject({
      code: 'CLASS_GROUP_HAS_DEPENDENCIES',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects deletion when lesson sessions still reference the class group', async () => {
    await expect(validateClassGroupDelete(classGroup, repositories({
      lessonSessions: {
        list: mock(async () => [{ id: 'session-1' }]),
      },
    }))).rejects.toMatchObject({
      code: 'CLASS_GROUP_HAS_DEPENDENCIES',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})
