import type { AuthorizationRepositories, GuardianActorMetadata, InteractiveActorMetadata } from '@edaya/authorization'
import {
  ALL_GUARDIAN_CAPABILITIES,
  ALL_STUDENT_CAPABILITIES,
  assertGuardianCapability,
  AuthorizationError,
  dispatchStudentAccess,
  effectiveGrantsForActor,
  GuardianCapability,
  Permission,
  StudentCapability,
} from '@edaya/authorization'
import { StudentClassEnrollmentStatus } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'
import { checkStudentAccess } from '../../../src/policy/resolvers/student'
import { AuthFixtures } from '../../support/authorization-fixtures'

function enrollmentRepos(classGroupId = 'class-1'): AuthorizationRepositories {
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
  } as unknown as AuthorizationRepositories
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

  test('assertGuardianCapability enforces linked student scope when targeted', () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1') as GuardianActorMetadata
    expect(() => assertGuardianCapability(
      actor,
      GuardianCapability.ReadStudentDetail,
      { studentId: 'student-1' },
    )).not.toThrow()

    expect(() => assertGuardianCapability(
      actor,
      GuardianCapability.ReadStudentDetail,
      { studentId: 'student-2' },
    )).toThrow(AuthorizationError)
  })

  test('portal capability sets stay explicit and grant-free', () => {
    const guardian = AuthFixtures.guardian.linkedTo('student-1') as InteractiveActorMetadata
    const student = AuthFixtures.student.enrolledIn() as InteractiveActorMetadata
    expect(ALL_GUARDIAN_CAPABILITIES).not.toEqual(ALL_STUDENT_CAPABILITIES)
    expect(ALL_GUARDIAN_CAPABILITIES).toContain(GuardianCapability.ReadSelfProfile)
    expect(Object.hasOwn(StudentCapability, 'ReadSelfProfile')).toBe(false)
    expect(effectiveGrantsForActor(guardian).permissions.size).toBe(0)
    expect(effectiveGrantsForActor(student).permissions.size).toBe(0)
  })
})
