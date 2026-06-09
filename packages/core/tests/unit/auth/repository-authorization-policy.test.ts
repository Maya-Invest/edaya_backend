import type { ActorMetadata } from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  createSystemActorMetadata,
  Permission,
  RepositoryAuthorizationPolicy,
  SYSTEM_ROLE_PERMISSIONS,
  systemAccessRoleId,
  systemRoleAssignmentId,
} from '../../../src/authorization'
import {
  checkAssessmentAccess as checkAcademicAssessmentAccess,
  checkClassGroupAccess as checkAcademicClassGroupAccess,
  checkReportCardResultAccess,
} from '../../../src/authorization/access-resolvers/academic-resolver'
import {
  checkAttendanceAccess as checkSchedulingAttendanceAccess,
  checkSessionAccess as checkSchedulingSessionAccess,
} from '../../../src/authorization/access-resolvers/scheduling-resolver'
import { AccessRole, StaffRole, StaffRoleAssignment, StudentClassEnrollmentStatus } from '../../../src/domains'

const now = new Date('2026-01-01T00:00:00Z')

function staffActor(_roles: StaffRole[], assuranceLevel = ActorAssuranceLevel.Strong): ActorMetadata {
  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    assuranceLevel,
  })
}

function studentActor(studentId = 'student-1'): ActorMetadata {
  return createStudentActorMetadata({
    subjectId: 'subject-student',
    studentId,
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
  })
}

function guardianActor(guardianId = 'guardian-1'): ActorMetadata {
  return createGuardianActorMetadata({
    subjectId: 'subject-guardian',
    guardianId,
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
  })
}

function systemActor(): ActorMetadata {
  return createSystemActorMetadata({
    systemId: 'system-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    reason: 'test',
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
  staffRoles: StaffRole[] = [StaffRole.Teacher],
): SchoolRepositories {
  const staff = { id: 'staff-1', schoolId: 'school-1', isActive: true }
  const accessRoles = Object.values(StaffRole).map(role => new AccessRole({
    id: systemAccessRoleId('school-1', role),
    schoolId: 'school-1',
    name: role,
    isSystemRole: true,
    systemRoleKey: role,
    permissions: SYSTEM_ROLE_PERMISSIONS[role],
  }))
  const systemAssignment = new StaffRoleAssignment({
    id: systemRoleAssignmentId('school-1', 'staff-1'),
    staffId: 'staff-1',
    schoolId: 'school-1',
    roleIds: staffRoles.map(role => systemAccessRoleId('school-1', role)),
    scopeGrants: [],
  })
  const repos = {
    assessments: {
      findById: mock(async id => id === 'assessment-1' ? { id, classGroupId: 'class-1' } : undefined),
      findByIds: mock(async (ids: string[]) => ids
        .filter(id => id === 'assessment-1')
        .map(id => ({ id, classGroupId: 'class-1' }))),
    },
    enrollments: {
      list: mock(async ({ studentId }: any = {}) => studentId
        ? [{ id: `enrollment-${studentId}`, studentId, classGroupId: 'class-1', status: StudentClassEnrollmentStatus.Active }]
        : []),
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
    },
    sessions: {
      findById: mock(async id => id === 'session-1' ? { id, classGroupId: 'class-1' } : undefined),
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
    },
  } as unknown as SchoolRepositories

  return { ...repos, ...overrides } as SchoolRepositories
}

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('RepositoryAuthorizationPolicy', () => {
  test('allows system actors and empty resource checks without repository access', async () => {
    const repos = createRepos()
    const policy = new RepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkStudentAccess(systemActor(), ['student-1'])
    await policy.checkClassGroupAccess(studentActor(), [])
    await policy.checkSessionAccess(systemActor(), ['missing-session'])
    await policy.checkFeeAccess(systemActor(), ['fee-1'])

    expect(repos.staffMembers.findById).not.toHaveBeenCalled()
  })

  test('enforces module school boundaries', async () => {
    await new RepositoryAuthorizationPolicy({ repositories: createRepos() })
      .checkModuleAccess(studentActor(), 'school-1', 'attendance')

    await expectForbidden(new RepositoryAuthorizationPolicy({ repositories: createRepos() })
      .checkModuleAccess(studentActor(), 'other-school', 'attendance'))
    await expectForbidden(new RepositoryAuthorizationPolicy({ repositories: createRepos() })
      .checkModuleAccess(guardianActor(), 'school-1', 'setup'))
  })

  test('resolves student, guardian, note, and health access by actor kind', async () => {
    const repos = createRepos()
    const policy = new RepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkStudentAccess(studentActor('student-1'), ['student-1'])
    await policy.checkStudentAccess(guardianActor(), ['student-1'])
    await policy.checkStudentAccess(staffActor([StaffRole.Teacher]), ['student-1'])
    await policy.checkGuardianAccess(guardianActor(), ['guardian-1'])
    await new RepositoryAuthorizationPolicy({ repositories: createRepos({}, [StaffRole.Principal]) })
      .checkGuardianAccess(staffActor([StaffRole.Principal]), ['guardian-1'])
    await policy.checkStudentNoteAccess(staffActor([StaffRole.Teacher]), ['note-1'])
    await new RepositoryAuthorizationPolicy({ repositories: createRepos({}, [StaffRole.Coordinator]) })
      .checkStudentHealthAccess(staffActor([StaffRole.Coordinator]), ['profile-1'])
    await policy.checkStudentHealthAccess(grantBackedStaffActor([Permission.STUDENT_HEALTH_READ]), ['profile-1'])
    await policy.checkStudentHealthAccess(grantBackedStaffActor([Permission.STUDENT_HEALTH_UPDATE]), ['profile-1'])

    await expectForbidden(policy.checkStudentAccess(studentActor('student-1'), ['student-2']))
    await expectForbidden(policy.checkStudentAccess(guardianActor('guardian-2'), ['student-1']))
    await expectForbidden(policy.checkGuardianAccess(guardianActor(), ['guardian-2']))
    await expectForbidden(policy.checkStudentNoteAccess(staffActor([StaffRole.Teacher]), ['missing-note']))
    await expectForbidden(policy.checkStudentHealthAccess(staffActor([StaffRole.Teacher]), ['profile-1']))
    await expectForbidden(policy.checkStudentHealthAccess(grantBackedStaffActor([Permission.STUDENT_UPDATE]), ['profile-1']))
    await expectForbidden(policy.checkStudentHealthAccess(grantBackedStaffActor([Permission.QUERY_STUDENT_DETAIL_READ]), ['profile-1']))
  })

  test('resolves academic assessment and report-card access through class and student relationships', async () => {
    const repos = createRepos()
    const policy = new RepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkClassGroupAccess(studentActor(), ['class-1'])
    await policy.checkClassGroupAccess(guardianActor(), ['class-1'])
    await policy.checkClassGroupAccess(staffActor([StaffRole.Teacher]), ['class-1'])
    await policy.checkAssessmentAccess(studentActor(), ['assessment-1'])
    await policy.checkAssessmentAccess(staffActor([StaffRole.Teacher]), ['assessment-1'])
    await policy.checkReportCardResultAccess(guardianActor(), ['result-1'])
    await policy.checkReportCardResultAccess(studentActor(), ['missing-result'])

    await expectForbidden(policy.checkClassGroupAccess(studentActor(), ['class-2']))
    await expectForbidden(policy.checkAssessmentAccess(studentActor(), ['missing-assessment']))
    await expectForbidden(policy.checkAssessmentAccess(staffActor([StaffRole.Teacher]), ['assessment-1', 'missing-assessment']))
  })

  test('resolves scheduling and attendance access through sessions and roster access', async () => {
    const repos = createRepos()
    const policy = new RepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkSessionAccess(studentActor(), ['session-1'])
    await policy.checkSessionAccess(guardianActor(), ['session-1'])
    await policy.checkSessionAccess(staffActor([StaffRole.Teacher]), ['session-1'])
    await policy.checkAttendanceAccess(staffActor([StaffRole.Teacher]), ['student-1'], ['session-1'])

    await expectForbidden(policy.checkSessionAccess(studentActor(), ['missing-session']))
    await expectForbidden(policy.checkSessionAccess(staffActor([StaffRole.Teacher]), ['missing-session']))
  })

  test('resolves finance access for staff, students, and guardians', async () => {
    const repos = createRepos()
    const policy = new RepositoryAuthorizationPolicy({ repositories: repos })

    await new RepositoryAuthorizationPolicy({ repositories: createRepos({}, [StaffRole.Accountant]) })
      .checkFeeAccess(staffActor([StaffRole.Accountant]), ['fee-1'])
    await policy.checkStudentFeeAccess(studentActor(), ['student-fee-1'])
    await policy.checkStudentFeeAccess(guardianActor(), ['student-fee-1'])
    await new RepositoryAuthorizationPolicy({ repositories: createRepos({}, [StaffRole.Coordinator]) })
      .checkStudentFeeAccess(staffActor([StaffRole.Coordinator]), ['student-fee-1'])

    await expectForbidden(policy.checkFeeAccess(studentActor(), ['fee-1']))
    await expectForbidden(policy.checkStudentFeeAccess(studentActor('student-2'), ['student-fee-1']))
    await expectForbidden(policy.checkStudentFeeAccess(guardianActor('guardian-2'), ['student-fee-1']))
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

    await expectForbidden(new RepositoryAuthorizationPolicy({ repositories: inactiveRepos }).checkStudentAccess(staffActor([StaffRole.Admin]), ['student-1']))
    await expectForbidden(new RepositoryAuthorizationPolicy({ repositories: crossSchoolRepos }).checkStudentAccess(staffActor([StaffRole.Admin]), ['student-1']))
  })

  test('covers academic resolver elevated paths and teacher relationship denials', async () => {
    await checkAcademicClassGroupAccess(systemActor(), ['missing-class'], createRepos())
    await checkAcademicClassGroupAccess(staffActor([StaffRole.Coordinator]), ['unassigned-class'], createRepos({}, [StaffRole.Coordinator]))
    await checkAcademicAssessmentAccess(staffActor([StaffRole.Admin]), ['missing-assessment'], createRepos({}, [StaffRole.Admin]))
    await checkReportCardResultAccess(staffActor([StaffRole.Teacher]), ['result-1'], createRepos())

    await expectForbidden(checkAcademicClassGroupAccess(staffActor([StaffRole.Accountant]), ['class-1'], createRepos({}, [StaffRole.Accountant])))
    await expectForbidden(checkAcademicClassGroupAccess(guardianActor(), ['class-1'], createRepos({
      enrollments: {
        list: mock(async () => []),
      } as any,
    })))
    await expectForbidden(checkAcademicAssessmentAccess(staffActor([StaffRole.Teacher]), ['assessment-1'], createRepos({
      staffAssignments: {
        list: mock(async () => []),
      } as any,
    })))
    await expectForbidden(checkReportCardResultAccess(guardianActor(), ['result-1'], createRepos({
      guardianLinks: {
        findOne: mock(async () => ({ id: 'link-1', guardianId: 'guardian-1', studentId: 'student-1', schoolId: 'other-school' })),
        list: mock(async () => []),
      } as any,
    })))
    await expectForbidden(checkReportCardResultAccess(staffActor([StaffRole.Teacher]), ['result-1'], createRepos({
      enrollments: {
        list: mock(async () => []),
      } as any,
    })))
    await expectForbidden(checkReportCardResultAccess(staffActor([StaffRole.Teacher]), ['result-1'], createRepos({
      staffAssignments: {
        list: mock(async () => []),
      } as any,
    })))
  })

  test('covers scheduling resolver empty, elevated, and denied relationship paths', async () => {
    await checkSchedulingSessionAccess(systemActor(), ['missing-session'], createRepos())
    await checkSchedulingAttendanceAccess(systemActor(), [], ['session-1'], createRepos())
    await checkSchedulingSessionAccess(staffActor([StaffRole.Principal]), ['missing-session'], createRepos({}, [StaffRole.Principal]))

    await expectForbidden(checkSchedulingSessionAccess(guardianActor(), ['session-1'], createRepos({
      enrollments: {
        list: mock(async () => []),
      } as any,
    })))
    await expectForbidden(checkSchedulingSessionAccess(staffActor([StaffRole.Accountant]), ['session-1'], createRepos({}, [StaffRole.Accountant])))
    await expectForbidden(checkSchedulingSessionAccess(staffActor([StaffRole.Teacher]), ['session-1'], createRepos({
      staffAssignments: {
        list: mock(async () => []),
      } as any,
    })))
    await expectForbidden(checkSchedulingAttendanceAccess(studentActor('student-2'), ['student-1'], ['session-1'], createRepos()))
    await expectForbidden(checkSchedulingAttendanceAccess(staffActor([StaffRole.Teacher]), ['student-1'], ['session-1'], createRepos({
      staffAssignments: {
        list: mock(async ({ classGroupId, staffId }: any = {}) =>
          (classGroupId === 'class-1' || !classGroupId) && staffId === 'staff-1'
            ? []
            : [{ id: 'assignment-other', staffId: 'other-staff', classGroupId: 'class-1' }]),
      } as any,
    })))
  })
})
