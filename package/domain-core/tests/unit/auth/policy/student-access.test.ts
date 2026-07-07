import type { SchoolRepositories } from '../../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import { AuthorizationError, Permission } from '../../../../src/capabilities/authorization'
import { dispatchStudentAccess } from '../../../../src/capabilities/authorization/policy/compose'
import { checkStudentAccess } from '../../../../src/capabilities/authorization/policy/resolvers/student'
import { StudentClassEnrollmentStatus } from '../../../../src/domain'
import { AuthFixtures } from '../../../support/authorization-fixtures'

function enrollmentRepos(classGroupId = 'class-1'): SchoolRepositories {
  return {
    enrollments: {
      list: mock(async (filter: { studentId?: { $in?: string[] } } = {}) => {
        const studentIds = filter.studentId?.$in ?? []
        return studentIds.map(studentId => ({
          id: `enrollment-${studentId}`,
          studentId,
          classGroupId,
          status: StudentClassEnrollmentStatus.Active,
        }))
      }),
    },
    classSubjects: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId })),
      ),
    },
    staffAssignments: {
      list: mock(async () => []),
    },
  } as unknown as SchoolRepositories
}

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('dispatchStudentAccess', () => {
  test('allows guardian linked to student', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await dispatchStudentAccess(actor, ['student-1'], enrollmentRepos())
  })

  test('denies guardian for unlinked student', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await expectForbidden(dispatchStudentAccess(actor, ['student-2'], enrollmentRepos()))
  })

  test('allows student self access', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    await dispatchStudentAccess(actor, ['student-1'], enrollmentRepos())
  })

  test('denies student access to another student', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    await expectForbidden(dispatchStudentAccess(actor, ['student-2'], enrollmentRepos()))
  })

  test('allows teacher homeroom for enrolled student', async () => {
    const actor = AuthFixtures.teacher.homeroom('class-1')
    await dispatchStudentAccess(actor, ['student-1'], enrollmentRepos('class-1'))
  })

  test('denies unassigned teacher', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await expectForbidden(dispatchStudentAccess(actor, ['student-1'], enrollmentRepos()))
  })

  test('allows staff with school-wide student read', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_READ])
    await dispatchStudentAccess(actor, ['student-1'], enrollmentRepos())
  })

  test('checkStudentAccess delegates to compose', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await checkStudentAccess(actor, ['student-1'], enrollmentRepos())
  })
})
