import type { ActorMetadata, EffectiveGrants } from '../../../src/capabilities/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import type { TestRole } from '../../support/effective-grants'
import { describe, expect, mock, test } from 'bun:test'
import { ActorAssuranceLevel, ASSIGNMENT_SCOPED_PERMISSIONS, AuthorizationError, createGuardianActorMetadata, createRepositoryAuthorizationPolicy, createStaffActorMetadata, createStudentActorMetadata, DefaultAuthorizationRepository, Permission, permissionRowsFromTemplatePermissions, resolveEffectiveGrants, resolveGuardianScope, resolveStudentScope } from '../../../src/capabilities/authorization'
import {
  checkAssessmentAccess as checkAcademicAssessmentAccess,
  checkClassGroupAccess as checkAcademicClassGroupAccess,
  checkReportCardResultAccess,
} from '../../../src/capabilities/authorization/policy/resolvers/academic'
import {
  checkAttendanceRecordAccess as checkSchedulingAttendanceRecordAccess,
  checkLessonSessionAccess as checkSchedulingLessonSessionAccess,
} from '../../../src/capabilities/authorization/policy/resolvers/scheduling'
import { AttendanceRecord, AttendanceStatus, StaffPermissionAssignment, StudentClassEnrollmentStatus } from '../../../src/domain'
import { AttachmentOwnerKind } from '../../../src/domain/school/attachment'
import { portalScopeForGuardian, portalScopeForStudent, TEST_ROLE_PERMISSIONS } from '../../support/effective-grants'

const TEST_ELEVATED_ROLES = new Set<TestRole>(['admin', 'principal'])

const STAFF_GRANT_ACADEMIC_YEAR_ID = 'year-1'
const now = new Date('2026-01-01T00:00:00Z')

function lessonAttendanceRecord(studentId: string, lessonSessionId: string): AttendanceRecord {
  return new AttendanceRecord({
    id: `record-${studentId}-${lessonSessionId}`,
    studentId,
    lessonSessionId,
    date: now,
    status: AttendanceStatus.Present,
  })
}

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
      academicYearId: STAFF_GRANT_ACADEMIC_YEAR_ID,
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
    studentScope: portalScopeForStudent(studentId, classGroupId),
  })
}

function guardianActor(guardianId = 'guardian-1', studentId = 'student-1', classGroupId = 'class-1'): ActorMetadata {
  return createGuardianActorMetadata({
    subjectId: 'subject-guardian',
    guardianId,
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    guardianScope: portalScopeForGuardian([studentId], [classGroupId]),
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

function buildStaffPermissionRows(
  staffId: string,
  schoolId: string,
  academicYearId: string,
  permissions: readonly Permission[],
  staffRoles: TestRole[],
): StaffPermissionAssignment[] {
  const scopeGrants = staffRoles.flatMap(role =>
    TEST_ROLE_PERMISSIONS[role]
      .filter(permission => role !== 'teacher' || !ASSIGNMENT_SCOPED_PERMISSIONS.includes(permission))
      .map(permission => ({
        permission,
        scopeType: 'school' as const,
        scopeEntityIds: [schoolId],
      })),
  )

  const fromTemplate = permissionRowsFromTemplatePermissions(
    staffId,
    schoolId,
    academicYearId,
    permissions,
    scopeGrants,
  ).map((row, index) => new StaffPermissionAssignment({
    id: `spa-${staffId}-${index}`,
    ...row,
    status: 'active',
  }))

  if (staffRoles.includes('coordinator')) {
    const coordinatorClassPermissions = [
      Permission.ACADEMIC_PROGRAM_UPDATE,
      Permission.CLASS_LOGBOOK_READ,
      Permission.GRADE_READ,
      Permission.ATTENDANCE_READ,
      ...ASSIGNMENT_SCOPED_PERMISSIONS.filter(permission => permissions.includes(permission)),
    ]
    const coordinatorScoped = coordinatorClassPermissions.map((permission, index) => new StaffPermissionAssignment({
      id: `spa-${staffId}-coordinator-${index}`,
      staffId,
      schoolId,
      academicYearId,
      permission,
      scopeIds: 'unassigned-class',
      status: 'active',
    }))
    return [...fromTemplate, ...coordinatorScoped]
  }

  if (!staffRoles.includes('teacher')) {
    return fromTemplate
  }

  const teacherScoped = ASSIGNMENT_SCOPED_PERMISSIONS
    .filter(permission => permissions.includes(permission))
    .map((permission, index) => new StaffPermissionAssignment({
      id: `spa-${staffId}-teacher-${index}`,
      staffId,
      schoolId,
      academicYearId,
      permission,
      scopeIds: 'class-1',
      status: 'active',
    }))

  return [...fromTemplate, ...teacherScoped]
}

function createRepos(
  overrides: Partial<SchoolRepositories> = {},
  staffRoles: TestRole[] = ['teacher'],
): SchoolRepositories {
  const staff = {
    id: 'staff-1',
    schoolId: 'school-1',
    subjectId: 'subject-staff',
    isActive: true,
  }
  const permissions = [...new Set(staffRoles.flatMap(role => [...TEST_ROLE_PERMISSIONS[role]]))]
  const permissionRows = buildStaffPermissionRows(
    'staff-1',
    'school-1',
    STAFF_GRANT_ACADEMIC_YEAR_ID,
    permissions,
    staffRoles,
  )

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
    lessonSessions: {
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
    schools: {
      findById: mock(async id => id === 'school-1'
        ? {
            id: 'school-1',
            ...(staffRoles.some(role => TEST_ELEVATED_ROLES.has(role))
              ? { ownerSubjectId: 'subject-staff' }
              : {}),
          }
        : undefined),
    },
    staffPermissionAssignments: {
      list: mock(async (filter: any = {}) => {
        if (filter.staffId && filter.staffId !== 'staff-1') {
          return []
        }
        if (filter.academicYearId && filter.academicYearId !== STAFF_GRANT_ACADEMIC_YEAR_ID) {
          return []
        }
        if (filter.status && filter.status !== 'active') {
          return []
        }
        return permissionRows
      }),
      save: mock(async () => {}),
    },
    studentFees: {
      findByIds: mock(async (ids: string[]) => ids.map(id => ({
        id,
        studentId: id === 'student-fee-1' ? 'student-1' : 'student-2',
        feeId: 'fee-1',
      }))),
      list: mock(async (filter: { feeId?: string } = {}) => {
        if (filter.feeId === 'fee-1') {
          return [{ id: 'student-fee-1', studentId: 'student-1', feeId: 'fee-1' }]
        }
        return []
      }),
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
    await policy.checkLessonSessionAccess(studentActor(), [])

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

  test('resolves scheduling and attendance access through lesson sessions and roster access', async () => {
    const repos = createRepos()
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkLessonSessionAccess(studentActor(), ['session-1'])
    await policy.checkLessonSessionAccess(guardianActor(), ['session-1'])
    await policy.checkLessonSessionAccess(await staffActor(['teacher'], repos), ['session-1'])
    await policy.checkAttendanceRecordAccess(
      await staffActor(['teacher'], repos),
      [lessonAttendanceRecord('student-1', 'session-1')],
    )

    await expectForbidden(policy.checkLessonSessionAccess(studentActor(), ['missing-session']))
  })

  test('resolves finance access for staff, students, and guardians', async () => {
    const repos = createRepos()
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    const reposAccountant = createRepos({}, ['accountant'])
    const accountantActor = await staffActor(['accountant'], reposAccountant)
    await createRepositoryAuthorizationPolicy({ repositories: reposAccountant })
      .checkFeeAccess(accountantActor, ['fee-1'])
    await createRepositoryAuthorizationPolicy({ repositories: reposAccountant })
      .checkStudentAccess(accountantActor, ['student-1'])
    await policy.checkStudentFeeAccess(studentActor(), ['student-fee-1'])
    await policy.checkStudentFeeAccess(guardianActor(), ['student-fee-1'])
    await policy.checkFeeAccess(studentActor(), ['fee-1'])
    await policy.checkFeeAccess(guardianActor(), ['fee-1'])

    const reposCoordinator2 = createRepos({}, ['coordinator'])
    await createRepositoryAuthorizationPolicy({ repositories: reposCoordinator2 })
      .checkStudentFeeAccess(await staffActor(['coordinator'], reposCoordinator2), ['student-fee-1'])

    await expectForbidden(policy.checkFeeAccess(studentActor('student-2'), ['fee-1']))
    await expectForbidden(policy.checkStudentFeeAccess(studentActor('student-2'), ['student-fee-1']))
    await expectForbidden(policy.checkStudentFeeAccess(guardianActor('guardian-2', 'student-2'), ['student-fee-1']))
    await expectForbidden(policy.checkFeeAccess(guardianActor('guardian-2', 'student-2'), ['fee-1']))
  })

  test('resolves attachment access through owner relationships for portal actors', async () => {
    const repos = createRepos({
      payments: {
        findById: mock(async (id: string) => id === 'payment-1'
          ? { id, studentFeeId: 'student-fee-1' }
          : undefined),
      },
    } as unknown as Partial<SchoolRepositories>)
    const policy = createRepositoryAuthorizationPolicy({ repositories: repos })

    await policy.checkAttachmentAccess(guardianActor(), [{
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-1',
    }])
    await policy.checkAttachmentAccess(guardianActor(), [{
      ownerKind: AttachmentOwnerKind.Payment,
      ownerId: 'payment-1',
    }])
    await policy.checkAttachmentAccess(studentActor(), [{
      ownerKind: AttachmentOwnerKind.ReportCard,
      ownerId: 'result-1',
    }])

    await expectForbidden(policy.checkAttachmentAccess(guardianActor('guardian-2', 'student-2'), [{
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-1',
    }]))
    await expectForbidden(policy.checkAttachmentAccess(studentActor(), [{
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: 'staff-1',
    }]))
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
      staffPermissionAssignments: {
        list: mock(async () => []),
        save: mock(async () => {}),
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
      staffPermissionAssignments: {
        list: mock(async () => []),
        save: mock(async () => {}),
      } as any,
    })
    await expectForbidden(checkReportCardResultAccess(await staffActor(['teacher'], reposNoAssign2), ['result-1'], reposNoAssign2))
  })

  test('covers scheduling resolver empty, elevated, and denied relationship paths', async () => {
    const reposPrincipal = createRepos({}, ['principal'])
    await checkSchedulingLessonSessionAccess(await staffActor(['principal'], reposPrincipal), ['missing-session'], reposPrincipal)
    await checkSchedulingAttendanceRecordAccess(
      await staffActor(['principal'], reposPrincipal),
      [lessonAttendanceRecord('student-1', 'session-1')],
      reposPrincipal,
    )

    const reposPrincipal2 = createRepos({}, ['principal'])
    await checkSchedulingLessonSessionAccess(await staffActor(['principal'], reposPrincipal2), ['missing-session'], reposPrincipal2)

    await expectForbidden(checkSchedulingLessonSessionAccess(guardianActor('guardian-1', 'student-1', 'class-different'), ['session-1'], createRepos()))

    const reposAcct2 = createRepos({}, ['accountant'])
    await expectForbidden(checkSchedulingLessonSessionAccess(await staffActor(['accountant'], reposAcct2), ['session-1'], reposAcct2))

    const reposNoAssign3 = createRepos({
      staffAssignments: {
        list: mock(async () => []),
      } as any,
      staffPermissionAssignments: {
        list: mock(async () => []),
        save: mock(async () => {}),
      } as any,
    })
    await expectForbidden(checkSchedulingLessonSessionAccess(await staffActor(['teacher'], reposNoAssign3), ['session-1'], reposNoAssign3))
    await expectForbidden(checkSchedulingAttendanceRecordAccess(
      studentActor('student-2'),
      [lessonAttendanceRecord('student-1', 'session-1')],
      createRepos(),
    ))

    const reposNoAssign4 = createRepos({
      staffAssignments: {
        list: mock(async ({ classGroupId, staffId }: any = {}) =>
          (classGroupId === 'class-1' || !classGroupId) && staffId === 'staff-1'
            ? []
            : [{ id: 'assignment-other', staffId: 'other-staff', classGroupId: 'class-1' }]),
      } as any,
      staffPermissionAssignments: {
        list: mock(async () => []),
        save: mock(async () => {}),
      } as any,
    })
    await expectForbidden(checkSchedulingAttendanceRecordAccess(
      await staffActor(['teacher'], reposNoAssign4),
      [lessonAttendanceRecord('student-1', 'session-1')],
      reposNoAssign4,
    ))
  })

  test('resolveActorGrants is staff-only; portal actors use resolveActorScope', async () => {
    const repos = createRepos({
      students: {
        findById: mock(async id => id === 'student-1' ? { id, schoolId: 'school-1' } : undefined),
      } as any,
      guardians: {
        findById: mock(async id => id === 'guardian-1' ? { id, schoolId: 'school-1' } : undefined),
      } as any,
      guardianLinks: {
        list: mock(async () => [{ guardianId: 'guardian-1', studentId: 'student-1', schoolId: 'school-1' }]),
      } as any,
      enrollments: {
        list: mock(async () => [{ studentId: 'student-1', classGroupId: 'class-1', status: 'active' }]),
      } as any,
    })

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
