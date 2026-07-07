import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
  Permission,
} from '../../../src/capabilities/authorization'
import {
  anyOperationModule,
  authorizeDeleteWithOperation,
  authorizeSaveWithOperation,
  operationModule,
} from '../../../src/capabilities/authorization/gates/operation-module'
import { GradeOperations } from '../../../src/capabilities/authorization/operations/grades'
import { EnrollmentOperations, StudentHealthOperations, StudentOperations } from '../../../src/capabilities/authorization/operations/students'
import { StudentClassEnrollmentStatus } from '../../../src/domain'
import { AuthFixtures } from '../../support/authorization-fixtures'

describe('operation gate helpers', () => {
  test('operationModule runs async context resolver before asserting', async () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    await operationModule(
      GradeOperations.input,
      async () => ({ classSubjectId: 'cs-math' }),
    )(actor)
  })

  test('operationModule passes static context objects through', () => {
    const actor = AuthFixtures.teacher.homeroom('cg-7a')
    expect(() => operationModule(
      GradeOperations.read,
      { classGroupId: 'cg-7a' },
    )(actor)).not.toThrow()
  })

  test('anyOperationModule succeeds when any operation is allowed', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_UPDATE])
    await anyOperationModule([
      StudentOperations.update,
      StudentOperations.directoryRead,
    ])(actor)
  })

  test('anyOperationModule throws when every operation is denied', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await expect(anyOperationModule(
      [GradeOperations.read, GradeOperations.input],
      { classGroupId: 'cg-7a' },
    )(actor)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('anyOperationModule rejects empty operation lists', () => {
    expect(() => anyOperationModule([])).toThrow('anyOperationModule requires at least one operation')
  })

  test('authorizeSaveWithOperation resolves dynamic operation refs and delegates save', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.ENROLLMENT_CREATE])
    const authorizeSave = mock(async () => {})
    const wrapped = authorizeSaveWithOperation(
      (_entity, existing) => (existing ? StudentOperations.update : EnrollmentOperations.create),
      async () => ({}),
      authorizeSave,
    )

    await wrapped(actor, { id: 'student-1' }, undefined, {} as SchoolRepositories)
    expect(authorizeSave).toHaveBeenCalled()
  })

  test('authorizeDeleteWithOperation asserts before delete authorization', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_HEALTH_READ])
    const authorizeDelete = mock(async () => {})
    const wrapped = authorizeDeleteWithOperation(
      StudentHealthOperations.read,
      async () => ({}),
      authorizeDelete,
    )

    await wrapped(actor, { id: 'student-1' }, {} as SchoolRepositories)
    expect(authorizeDelete).toHaveBeenCalled()
  })
})

describe('staff student access strategy', () => {
  const now = new Date('2026-09-01T00:00:00Z')

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
    } as unknown as SchoolRepositories
  }

  test('allows staff with class-scoped assignment permissions via enrollment lookup', async () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.GRADE_INPUT]),
        scopeGrants: [{
          permission: Permission.GRADE_INPUT,
          scopeType: 'class_group',
          scopeEntityIds: ['class-1'],
        }],
        scopeIdsByPermission: { [Permission.GRADE_INPUT]: 'class-1' },
        isElevated: false,
      },
    })

    const { dispatchStudentAccess } = await import('../../../src/capabilities/authorization/policy/compose')
    await dispatchStudentAccess(actor, ['student-1'], enrollmentRepos('class-1'))
  })

  test('allows staff with direct student-scoped permissions without enrollment lookup', async () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.QUERY_STUDENT_DETAIL_READ]),
        scopeGrants: [{
          permission: Permission.QUERY_STUDENT_DETAIL_READ,
          scopeType: 'student',
          scopeEntityIds: ['student-1'],
        }],
        scopeIdsByPermission: { [Permission.QUERY_STUDENT_DETAIL_READ]: 'student-1' },
        isElevated: false,
      },
    })

    const { dispatchStudentAccess } = await import('../../../src/capabilities/authorization/policy/compose')
    await dispatchStudentAccess(actor, ['student-1'], enrollmentRepos('class-1'))
  })

  test('denies staff without class or student scoped access', async () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.GRADE_INPUT]),
        scopeGrants: [{
          permission: Permission.GRADE_INPUT,
          scopeType: 'class_group',
          scopeEntityIds: ['class-2'],
        }],
        scopeIdsByPermission: { [Permission.GRADE_INPUT]: 'class-2' },
        isElevated: false,
      },
    })

    const { dispatchStudentAccess } = await import('../../../src/capabilities/authorization/policy/compose')
    await expect(dispatchStudentAccess(actor, ['student-1'], enrollmentRepos('class-1')))
      .rejects
      .toBeInstanceOf(AuthorizationError)
  })

  test('denies staff when enrolled student has no class group mapping', async () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.GRADE_INPUT]),
        scopeGrants: [{
          permission: Permission.GRADE_INPUT,
          scopeType: 'class_group',
          scopeEntityIds: ['class-1'],
        }],
        scopeIdsByPermission: { [Permission.GRADE_INPUT]: 'class-1' },
        isElevated: false,
      },
    })

    const emptyRepos = { enrollments: { list: mock(async () => []) } } as unknown as SchoolRepositories
    const { dispatchStudentAccess } = await import('../../../src/capabilities/authorization/policy/compose')
    await expect(dispatchStudentAccess(actor, ['student-1'], emptyRepos))
      .rejects
      .toBeInstanceOf(AuthorizationError)
  })
})
