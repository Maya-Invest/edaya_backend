import { StudentClassEnrollmentStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildAppShellCounts } from '../support/app-shell-reference'

describe('buildAppShellCounts', () => {
  test('returns people counts and active enrollment counts grouped by class', async () => {
    const repositories = {
      students: { count: async () => 12 },
      guardians: { count: async () => 8 },
      staffMembers: { count: async () => 5 },
      teachers: { count: async () => 4 },
      enrollments: {
        list: async () => [
          { classGroupId: 'class-a', status: StudentClassEnrollmentStatus.Active },
          { classGroupId: 'class-a', status: StudentClassEnrollmentStatus.Active },
          { classGroupId: 'class-b', status: StudentClassEnrollmentStatus.Active },
        ],
      },
    }

    await expect(buildAppShellCounts(repositories as never, {
      schoolId: 'school-1',
      classGroupIds: ['class-a', 'class-b', 'class-c'],
    })).resolves.toEqual({
      schoolId: 'school-1',
      activeEnrollmentCountsByClass: {
        'class-a': 2,
        'class-b': 1,
        'class-c': 0,
      },
      studentCount: 12,
      guardianCount: 8,
      staffCount: 5,
      teacherCount: 4,
    })
  })

  test('skips enrollment query when no class ids are provided', async () => {
    let enrollmentListCalls = 0
    const repositories = {
      students: { count: async () => 1 },
      guardians: { count: async () => 2 },
      staffMembers: { count: async () => 3 },
      teachers: { count: async () => 2 },
      enrollments: {
        list: async () => {
          enrollmentListCalls += 1
          return []
        },
      },
    }

    await expect(buildAppShellCounts(repositories as never, {
      schoolId: 'school-1',
    })).resolves.toEqual({
      schoolId: 'school-1',
      activeEnrollmentCountsByClass: {},
      studentCount: 1,
      guardianCount: 2,
      staffCount: 3,
      teacherCount: 2,
    })

    expect(enrollmentListCalls).toBe(0)
  })
})
