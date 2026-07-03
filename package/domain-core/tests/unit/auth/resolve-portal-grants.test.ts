import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  Permission,
  resolveGuardianGrants,
  resolveStudentGrants,
} from '../../../src/capabilities/authorization'

function createPortalRepos(overrides: Partial<SchoolRepositories> = {}): SchoolRepositories {
  return {
    guardians: {
      findById: mock(async id => id === 'guardian-1' ? { id, schoolId: 'school-1' } : undefined),
    },
    students: {
      findById: mock(async id => id === 'student-1' ? { id, schoolId: 'school-1' } : undefined),
    },
    guardianLinks: {
      list: mock(async () => [{ id: 'link-1', guardianId: 'guardian-1', studentId: 'student-1', schoolId: 'school-1' }]),
    },
    enrollments: {
      list: mock(async () => [{
        id: 'enrollment-1',
        studentId: 'student-1',
        classGroupId: 'class-1',
        status: 'active',
      }]),
    },
    ...overrides,
  } as SchoolRepositories
}

describe('resolve portal grants', () => {
  test('builds scopeIdsByPermission for guardians from links and enrollments', async () => {
    const repos = createPortalRepos()

    const grants = await resolveGuardianGrants({
      guardianId: 'guardian-1',
      schoolId: 'school-1',
      repositories: repos,
    })

    expect(grants.scopeGrants).toEqual([])
    expect(grants.scopeIdsByPermission?.[Permission.QUERY_STUDENT_DETAIL_READ]).toBe('student-1')
    expect(grants.scopeIdsByPermission?.[Permission.GRADE_READ]).toBe('class-1')
    expect(grants.permissions.has(Permission.QUERY_WORKSPACE_READ)).toBe(true)
  })

  test('builds scopeIdsByPermission for students', async () => {
    const repos = createPortalRepos()

    const grants = await resolveStudentGrants({
      studentId: 'student-1',
      schoolId: 'school-1',
      repositories: repos,
    })

    expect(grants.scopeGrants).toEqual([])
    expect(grants.scopeIdsByPermission?.[Permission.QUERY_STUDENT_DETAIL_READ]).toBe('student-1')
    expect(grants.scopeIdsByPermission?.[Permission.GRADE_READ]).toBe('class-1')
    expect(grants.permissions.has(Permission.QUERY_WORKSPACE_READ)).toBe(true)
  })
})
