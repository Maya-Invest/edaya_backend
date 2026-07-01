import type { ActorMetadata, EffectiveGrants } from '../../../src/capabilities/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import type { TestRole } from '../../support/effective-grants'
import { describe, expect, mock, test } from 'bun:test'
import { ActorAssuranceLevel, ASSIGNMENT_SCOPED_PERMISSIONS, AuthorizationError, createGuardianActorMetadata, createRepositoryAuthorizationPolicy, createStaffActorMetadata, createStudentActorMetadata, DefaultAuthorizationRepository, GUARDIAN_PORTAL_PERMISSIONS, Permission, resolveEffectiveGrants, STUDENT_PORTAL_PERMISSIONS } from '../../../src/capabilities/authorization'
import {
  checkAssessmentAccess as checkAcademicAssessmentAccess,
  checkClassGroupAccess as checkAcademicClassGroupAccess,
  checkReportCardResultAccess,
} from '../../../src/capabilities/authorization/policy/resolvers/academic'
import {
  checkAttendanceAccess as checkSchedulingAttendanceAccess,
  checkSessionAccess as checkSchedulingSessionAccess,
} from '../../../src/capabilities/authorization/policy/resolvers/scheduling'
import { AccessRole, StaffRoleAssignment, StudentClassEnrollmentStatus } from '../../../src/domain'
import { TEST_ROLE_PERMISSIONS } from '../../support/effective-grants'

const now = new Date('2026-01-01T00:00:00Z')

async function staffActor(
  roles: TestRole[],
  repos?: SchoolRepositories,
  assuranceLevel = ActorAssuranceLevel.Strong,
): Promise<ActorMetadata> {
  const finalRepos = repos ?? createRepos({}, roles)
  let grants: EffectiveGrants
  try {
    grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories: finalRepos,
    })
  }
  catch {
    grants = {
      permissions: new Set(),
      scopeGrants: [],
      isElevated: false,
    }
  }

  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    effectiveGrants: grants,
    requestId: 'request-1',
    authenticatedAt: now,
    assuranceLevel,
  })
}

function studentActor(studentId = 'student-1', classGroupId = 'class-1'): ActorMetadata {
  return createStudentActorMetadata({
    subjectId: 'subject-student',
    studentId,
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    effectiveGrants: {
      permissions: STUDENT_PORTAL_PERMISSIONS,
      scopeGrants: [
        ...Array.from(STUDENT_PORTAL_PERMISSIONS).map(permission => ({
          permission,
          scopeType: 'student' as const,
          scopeEntityIds: [studentId],
        })),
        ...Array.from(STUDENT_PORTAL_PERMISSIONS).map(permission => ({
          permission,
          scopeType: 'class_group' as const,
          scopeEntityIds: [classGroupId],
        })),
      ],
      isElevated: false,
    },
  })
}

function guardianActor(guardianId = 'guardian-1', studentId = 'student-1', classGroupId = 'class-1'): ActorMetadata {
  return createGuardianActorMetadata({
    subjectId: 'subject-guardian',
    guardianId,
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    effectiveGrants: {
      permissions: GUARDIAN_PORTAL_PERMISSIONS,
      scopeGrants: [
        ...Array.from(GUARDIAN_PORTAL_PERMISSIONS).map(permission => ({
          permission,
          scopeType: 'student' as const,
          scopeEntityIds: [studentId],
        })),
        ...Array.from(GUARDIAN_PORTAL_PERMISSIONS).map(permission => ({
          permission,
          scopeType: 'class_group' as const,
          scopeEntityIds: [classGroupId],
        })),
      ],
      isElevated: false,
    },
  })
}

function grantBackedStaffActor(
  permissions: readonly Permission[],
  assuranceLevel = ActorAssuranceLevel.Strong,
): ActorMetadata {
  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    assuranceLevel,
    effectiveGrants: {
      permissions: new Set(permissions),
      scopeGrants: permissions.map(permission => ({
        permission,
        scopeType: 'school',
        scopeEntityIds: ['school-1'],
      })),
      isElevated: false,
    },
  })
}

function createRepos(
  overrides: Partial<SchoolRepositories> = {},
  staffRoles: TestRole[] = ['teacher'],
): SchoolRepositories {
  const staff = { id: 'staff-1', schoolId: 'school-1', isActive: true }
  const accessRoles = (Object.keys(TEST_ROLE_PERMISSIONS) as TestRole[])
    .filter(role => TEST_ROLE_PERMISSIONS[role].length > 0)
    .map(role => new AccessRole({
      id: `role-${role}`,
      schoolId: 'school-1',
      name: role,
      permissions: [...TEST_ROLE_PERMISSIONS[role]],
      status: 'active',
    }))
  const systemAssignment = new StaffRoleAssignment({
    id: `assignment-staff-1`,
    staffId: 'staff-1',
    schoolId: 'school-1',
    roleIds: staffRoles.map(role => `role-${role}`),
    status: 'active',
    scopeGrants: staffRoles.flatMap(role =>
      TEST_ROLE_PERMISSIONS[role]
        .filter(permission => role !== 'teacher' || !ASSIGNMENT_SCOPED_PERMISSIONS.includes(permission))
        .map(permission => ({
          permission,
          scopeType: 'school' as const,
          scopeEntityIds: ['school-1'],
        })),
    ),
  })
  const repos = {
    assessments: {
      findById: mock(async id => id === 'assessment-1' ? { id, classGroupId: 'class-1' } : undefined),
      findByIds: mock(async (ids: string[]) => ids
        .filter(id => id === 'assessment-1')
        .map(id => ({ id, classGroupId: 'class-1' }))),
    },
    enrollments: {
      list: mock(async (filter: any = {}) => {
        const studentIds = typeof filter.studentId === 'string'
          ? [filter.studentId]
          : Array.isArray(filter.studentId?.$in)
            ? filter.studentId.$in
            : []

        return studentIds.map((studentId: string) => ({
          id: `enrollment-${studentId}`,
          studentId,
          classGroupId: 'class-1',
          status: StudentClassEnrollmentStatus.Active,
        }))
      }),
    },
    guardianLinks: {
      findOne: mock(async ({ guardianId, studentId }: any = {}) =>
        guardianId === 'guardian-1' && studentId === 'student-1'
          ? { id: 'link-1', guardianId, studentId, schoolId: 'school-1' }
          : undefined),
      list: mock(async ({ guardianId }: any = {}) =>
        guardianId === 'guardian-1'
          ? [{ id: 'link-1', guardianId, studentId: 'student-1', schoolId: 'school-1' }]
          : []),
    },
    results: {
      findById: mock(async id => id === 'result-1' ? { id, studentId: 'student-1' } : undefined),
      findByIds: mock(async (ids: string[]) => ids
        .filter(id => id === 'result-1')
        .map(id => ({ id, studentId: 'student-1' }))),
    },
    sessions: {
      findById: mock(async id => id === 'session-1' ? { id, classGroupId: 'class-1' } : undefined),
      findByIds: mock(async (ids: string[]) => ids
        .filter(id => id === 'session-1')
        .map(id => ({ id, classGroupId: 'class-1' }))),
    },
    staffAssignments: {
      list: mock(async ({ classGroupId, staffId }: any = {}) =>
        (!classGroupId || classGroupId === 'class-1') && (!staffId || staffId === 'staff-1')
          ? [{ id: 'assignment-1', staffId: 'staff-1', classGroupId: 'class-1' }]
          : []),
    },
    staffMembers: {
      findById: mock(async id => id === 'staff-1' ? staff : undefined),
    },
    accessRoles: {
      findById: mock(async (id: string) => accessRoles.find(role => role.id === id)),
      findByIds: mock(async (ids: string[]) => accessRoles.filter(role => ids.includes(role.id))),
      list: mock(async () => accessRoles),
      save: mock(async () => {}),
    },
    staffRoleAssignments: {
      findById: mock(async (id: string) => id === systemAssignment.id ? systemAssignment : undefined),
      findByIds: mock(async (ids: string[]) => ids.includes(systemAssignment.id) ? [systemAssignment] : []),
      list: mock(async () => [systemAssignment]),
      save: mock(async () => {}),
    },
    studentFees: {
      findByIds: mock(async (ids: string[]) => ids.map(id => ({ id, studentId: 'student-1' }))),
    },
    studentNotes: {
      findById: mock(async (id: string) => id === 'note-1' ? { id, studentId: 'student-1' } : undefined),
      findByIds: mock(async (ids: string[]) => ids
        .filter(id => id === 'note-1')
        .map(id => ({ id, studentId: 'student-1' }))),
    },
    students: {
      findById: mock(async id => id === 'student-1' ? { id, schoolId: 'school-1' } : undefined),
    },
    guardians: {
      findById: mock(async id => id === 'guardian-1' ? { id, schoolId: 'school-1' } : undefined),
    },
  } as unknown as SchoolRepositories

  (repos as any).authorization = new DefaultAuthorizationRepository(repos)

  return { ...repos, ...overrides } as SchoolRepositories
}

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('createRepositoryAuthorizationPolicy', () => {
  test('allows empty resource checks without repository access', async () => {
    const repos = createRepos()
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkClassGroupAccess(studentActor(), [])
    await policy.checkSessionAccess(studentActor(), [])

    expect(repos.staffMembers.findById).not.toHaveBeenCalled()
  })

  test('resolves student, guardian, note, and health access by actor kind', async () => {
    const repos = createRepos()
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkStudentAccess(studentActor('student-1'), ['student-1'])
    await policy.checkStudentAccess(guardianActor(), ['student-1'])
    await policy.checkStudentAccess(await staffActor(['teacher'], repos), ['student-1'])
    await policy.checkGuardianAccess(guardianActor(), ['guardian-1'])

    const reposPrincipal = createRepos({}, ['principal'])
    await createRepositoryAuthorizationPolicy({ repositories: reposPrincipal })
      .checkGuardianAccess(await staffActor(['principal'], reposPrincipal), ['guardian-1'])
    await policy.checkStudentNoteAccess(await staffActor(['teacher'], repos), ['note-1'])

    const reposCoordinator = createRepos({}, ['coordinator'])
    await createRepositoryAuthorizationPolicy({ repositories: reposCoordinator })
      .checkStudentHealthAccess(await staffActor(['coordinator'], reposCoordinator), ['profile-1'])
    await policy.checkStudentHealthAccess(grantBackedStaffActor([Permission.STUDENT_HEALTH_READ]), ['profile-1'])
    await policy.checkStudentHealthAccess(grantBackedStaffActor([Permission.STUDENT_HEALTH_UPDATE]), ['profile-1'])

    await expectForbidden(policy.checkStudentAccess(studentActor('student-1'), ['student-2']))
    await expectForbidden(policy.checkStudentAccess(guardianActor('guardian-2', 'student-2'), ['student-1']))
    await expectForbidden(policy.checkGuardianAccess(guardianActor(), ['guardian-2']))
    await expectForbidden(policy.checkStudentNoteAccess(await staffActor(['teacher'], repos), ['missing-note']))
    await expectForbidden(policy.checkStudentHealthAccess(await staffActor(['teacher'], repos), ['profile-1']))
    await expectForbidden(policy.checkStudentHealthAccess(grantBackedStaffActor([Permission.STUDENT_UPDATE]), ['profile-1']))
    await expectForbidden(policy.checkStudentHealthAccess(grantBackedStaffActor([Permission.QUERY_STUDENT_DETAIL_READ]), ['profile-1']))
  })

  test('resolves academic assessment and report-card access through class and student relationships', async () => {
    const repos = createRepos()
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkClassGroupAccess(studentActor(), ['class-1'])
    await policy.checkClassGroupAccess(guardianActor(), ['class-1'])
    await policy.checkClassGroupAccess(await staffActor(['teacher'], repos), ['class-1'])
    await policy.checkAssessmentAccess(studentActor(), ['assessment-1'])
    await policy.checkAssessmentAccess(await staffActor(['teacher'], repos), ['assessment-1'])
    await policy.checkReportCardResultAccess(guardianActor(), ['result-1'])
    await policy.checkReportCardResultAccess(studentActor(), ['missing-result'])

    await expectForbidden(policy.checkClassGroupAccess(studentActor(), ['class-2']))
    await expectForbidden(policy.checkAssessmentAccess(studentActor(), ['missing-assessment']))
    await expectForbidden(policy.checkAssessmentAccess(await staffActor(['teacher'], repos), ['assessment-1', 'missing-assessment']))
  })

  test('resolves scheduling and attendance access through sessions and roster access', async () => {
    const repos = createRepos()
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkSessionAccess(studentActor(), ['session-1'])
    await policy.checkSessionAccess(guardianActor(), ['session-1'])
    await policy.checkSessionAccess(await staffActor(['teacher'], repos), ['session-1'])
    await policy.checkAttendanceAccess(await staffActor(['teacher'], repos), ['student-1'], ['session-1'])

    await expectForbidden(policy.checkSessionAccess(studentActor(), ['missing-session']))
    await expectForbidden(policy.checkSessionAccess(await staffActor(['teacher'], repos), ['missing-session']))
  })

  test('resolves finance access for staff, students, and guardians', async () => {
    const repos = createRepos()
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    const reposAccountant = createRepos({}, ['accountant'])
    await createRepositoryAuthorizationPolicy({ repositories: reposAccountant })
      .checkFeeAccess(await staffActor(['accountant'], reposAccountant), ['fee-1'])
    await policy.checkStudentFeeAccess(studentActor(), ['student-fee-1'])
    await policy.checkStudentFeeAccess(guardianActor(), ['student-fee-1'])

    const reposCoordinator2 = createRepos({}, ['coordinator'])
    await createRepositoryAuthorizationPolicy({ repositories: reposCoordinator2 })
      .checkStudentFeeAccess(await staffActor(['coordinator'], reposCoordinator2), ['student-fee-1'])

    await expectForbidden(policy.checkFeeAccess(studentActor(), ['fee-1']))
    await expectForbidden(policy.checkStudentFeeAccess(studentActor('student-2'), ['student-fee-1']))
    await expectForbidden(policy.checkStudentFeeAccess(guardianActor('guardian-2', 'student-2'), ['student-fee-1']))
  })

  test('rejects inactive or cross-school staff before role checks', async () => {
    const inactiveRepos = createRepos({
      staffMembers: {
        findById: mock(async () => ({ id: 'staff-1', schoolId: 'school-1', isActive: false })),
      } as any,
    })
    const crossSchoolRepos = createRepos({
      staffMembers: {
        findById: mock(async () => ({ id: 'staff-1', schoolId: 'other-school', isActive: true })),
      } as any,
    })

    await expectForbidden(createRepositoryAuthorizationPolicy({ repositories: inactiveRepos }).checkStudentAccess(await staffActor(['admin'], inactiveRepos), ['student-1']))
    await expectForbidden(createRepositoryAuthorizationPolicy({ repositories: crossSchoolRepos }).checkStudentAccess(await staffActor(['admin'], crossSchoolRepos), ['student-1']))
  })

  test('covers academic resolver elevated paths and teacher relationship denials', async () => {
    const reposAdmin = createRepos({}, ['admin'])
    await checkAcademicClassGroupAccess(await staffActor(['admin'], reposAdmin), ['missing-class'], reposAdmin)

    const reposCoord = createRepos({}, ['coordinator'])
    await checkAcademicClassGroupAccess(await staffActor(['coordinator'], reposCoord), ['unassigned-class'], reposCoord)

    await checkAcademicAssessmentAccess(await staffActor(['admin'], reposAdmin), ['missing-assessment'], reposAdmin)

    const reposTeacher = createRepos()
    await checkReportCardResultAccess(await staffActor(['teacher'], reposTeacher), ['result-1'], reposTeacher)

    const reposAcct = createRepos({}, ['accountant'])
    await expectForbidden(checkAcademicClassGroupAccess(await staffActor(['accountant'], reposAcct), ['class-1'], reposAcct))
    await expectForbidden(checkAcademicClassGroupAccess(guardianActor('guardian-1', 'student-1', 'class-different'), ['class-1'], createRepos()))

    const reposNoAssign = createRepos({
      staffAssignments: {
        list: mock(async () => []),
      } as any,
    })
    await expectForbidden(checkAcademicAssessmentAccess(await staffActor(['teacher'], reposNoAssign), ['assessment-1'], reposNoAssign))
    await expectForbidden(checkReportCardResultAccess(guardianActor('guardian-1', 'student-different'), ['result-1'], createRepos()))

    const reposNoEnroll = createRepos({
      enrollments: {
        list: mock(async () => []),
      } as any,
    })
    await expectForbidden(checkReportCardResultAccess(await staffActor(['teacher'], reposNoEnroll), ['result-1'], reposNoEnroll))

    const reposNoAssign2 = createRepos({
      staffAssignments: {
        list: mock(async () => []),
      } as any,
    })
    await expectForbidden(checkReportCardResultAccess(await staffActor(['teacher'], reposNoAssign2), ['result-1'], reposNoAssign2))
  })

  test('covers scheduling resolver empty, elevated, and denied relationship paths', async () => {
    const reposPrincipal = createRepos({}, ['principal'])
    await checkSchedulingSessionAccess(await staffActor(['principal'], reposPrincipal), ['missing-session'], reposPrincipal)
    await checkSchedulingAttendanceAccess(await staffActor(['principal'], reposPrincipal), [], ['session-1'], reposPrincipal)

    const reposPrincipal2 = createRepos({}, ['principal'])
    await checkSchedulingSessionAccess(await staffActor(['principal'], reposPrincipal2), ['missing-session'], reposPrincipal2)

    await expectForbidden(checkSchedulingSessionAccess(guardianActor('guardian-1', 'student-1', 'class-different'), ['session-1'], createRepos()))

    const reposAcct2 = createRepos({}, ['accountant'])
    await expectForbidden(checkSchedulingSessionAccess(await staffActor(['accountant'], reposAcct2), ['session-1'], reposAcct2))

    const reposNoAssign3 = createRepos({
      staffAssignments: {
        list: mock(async () => []),
      } as any,
    })
    await expectForbidden(checkSchedulingSessionAccess(await staffActor(['teacher'], reposNoAssign3), ['session-1'], reposNoAssign3))
    await expectForbidden(checkSchedulingAttendanceAccess(studentActor('student-2'), ['student-1'], ['session-1'], createRepos()))

    const reposNoAssign4 = createRepos({
      staffAssignments: {
        list: mock(async ({ classGroupId, staffId }: any = {}) =>
          (classGroupId === 'class-1' || !classGroupId) && staffId === 'staff-1'
            ? []
            : [{ id: 'assignment-other', staffId: 'other-staff', classGroupId: 'class-1' }]),
      } as any,
    })
    await expectForbidden(checkSchedulingAttendanceAccess(await staffActor(['teacher'], reposNoAssign4), ['student-1'], ['session-1'], reposNoAssign4))
  })

  test('resolves actor grants for students and guardians via auth repository', async () => {
    const repos = createRepos({
      students: {
        findById: mock(async id => id === 'student-1' ? { id, schoolId: 'school-1' } : undefined),
      } as any,
      guardians: {
        findById: mock(async id => id === 'guardian-1' ? { id, schoolId: 'school-1' } : undefined),
      } as any,
    })

    const studentGrants = await repos.authorization.resolveActorGrants({
      actorId: 'student-1',
      actorType: 'student',
      schoolId: 'school-1',
    })
    expect(studentGrants.permissions.has(Permission.GRADE_READ)).toBe(true)
    expect(studentGrants.scopeGrants).toContainEqual({
      permission: Permission.GRADE_READ,
      scopeType: 'class_group',
      scopeEntityIds: ['class-1'],
    })

    const guardianGrants = await repos.authorization.resolveActorGrants({
      actorId: 'guardian-1',
      actorType: 'guardian',
      schoolId: 'school-1',
    })
    expect(guardianGrants.permissions.has(Permission.GRADE_READ)).toBe(true)
    expect(guardianGrants.scopeGrants).toContainEqual({
      permission: Permission.GRADE_READ,
      scopeType: 'student',
      scopeEntityIds: ['student-1'],
    })
    expect(guardianGrants.scopeGrants).toContainEqual({
      permission: Permission.GRADE_READ,
      scopeType: 'class_group',
      scopeEntityIds: ['class-1'],
    })
  })
})
