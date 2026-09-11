import type { AuthorizationRepositories } from '@edaya/authorization'
import {
  createRepositoryAuthorizationPolicy,
  DefaultAuthorizationRepository,
  resolveGuardianScope,
  resolveStudentScope,
} from '@edaya/authorization'
import { StudentClassEnrollmentStatus } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'
import { AuthFixtures } from '../../support/authorization-fixtures'

function minimalRepos(): AuthorizationRepositories & { authorization: DefaultAuthorizationRepository } {
  const repos = {
    enrollments: {
      list: mock(async (filter: { studentId?: { $in?: string[] } } = {}) => {
        const studentIds = filter.studentId?.$in ?? []
        return studentIds.map(studentId => ({
          id: `enrollment-${studentId}`,
          studentId,
          classGroupId: 'class-1',
          status: StudentClassEnrollmentStatus.Active,
        }))
      }),
    },
    classSubjects: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId: 'class-1' })),
      ),
    },
    staffAssignments: {
      list: mock(async () => []),
    },
    students: {
      findById: mock(async id => id === 'student-1' ? { id, schoolId: 'school-1' } : undefined),
    },
    guardians: {
      findById: mock(async id => id === 'guardian-1' ? { id, hasAccess: true, schoolId: 'school-1' } : undefined),
    },
    guardianLinks: {
      list: mock(async () => [{ guardianId: 'guardian-1', studentId: 'student-1', schoolId: 'school-1' }]),
    },
  } as unknown as AuthorizationRepositories

  const authRepo = new DefaultAuthorizationRepository(repos)

  return Object.assign(repos, { authorization: authRepo })
}

describe('createRepositoryAuthorizationPolicy smoke', () => {
  test('allows empty resource checks without repository access', async () => {
    const policy = createRepositoryAuthorizationPolicy({ repositories: minimalRepos() })
    await policy.checkStudentAccess(AuthFixtures.student.enrolledIn(), [])
    await policy.checkClassGroupAccess(AuthFixtures.guardian.linkedTo('student-1'), [])
  })

  test('delegates student access through compose', async () => {
    const repos = minimalRepos()
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkStudentAccess(AuthFixtures.guardian.linkedTo('student-1'), ['student-1'])
    await expect(
      policy.checkStudentAccess(AuthFixtures.guardian.linkedTo('student-1'), ['student-2']),
    ).rejects.toThrow()
  })

  test('resolveActorGrants is staff-only; portal actors use resolveActorScope', async () => {
    const repos = minimalRepos()

    await expect(repos.authorization.resolveActorGrants({
      actorId: 'student-1',
      actorType: 'student',
      schoolId: 'school-1',
    })).rejects.toThrow('staff-only')

    const studentScope = await resolveStudentScope({
      studentId: 'student-1',
      schoolId: 'school-1',
      repositories: repos,
    })
    expect(studentScope.studentId).toBe('student-1')
    expect(studentScope.classGroupId).toBe('class-1')

    const guardianScope = await resolveGuardianScope({
      guardianId: 'guardian-1',
      schoolId: 'school-1',
      repositories: repos,
    })
    expect(guardianScope.studentIds).toEqual(['student-1'])
    expect(guardianScope.classGroupIds).toEqual(['class-1'])
  })
})
