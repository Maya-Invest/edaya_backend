import type { AuthorizationPolicy } from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, test } from 'bun:test'
import {
  AuthorizationError,
  authorize,
  createStaffActorMetadata,
  Permission,
  permissionDefinitions,
  RepositoryAuthorizationPolicy,
  SYSTEM_ROLE_PERMISSIONS,
  systemAccessRoleId,
  systemRoleAssignmentId,
} from '../../../src/authorization'
import { AccessRole, StaffRole, StaffRoleAssignment } from '../../../src/entities'
import { anyPermissionAction, permissionAction } from '../../../src/shared'

function noopPolicy(): AuthorizationPolicy {
  return {
    checkStudentAccess: async () => {},
    checkGuardianAccess: async () => {},
    checkStudentNoteAccess: async () => {},
    checkStudentHealthAccess: async () => {},
    checkClassGroupAccess: async () => {},
    checkAssessmentAccess: async () => {},
    checkReportCardResultAccess: async () => {},
    checkFeeAccess: async () => {},
    checkStudentFeeAccess: async () => {},
    checkSessionAccess: async () => {},
    checkAttendanceAccess: async () => {},
    checkModuleAccess: async () => {},
  }
}

const now = new Date('2026-01-01T00:00:00Z')

function staffActor(roles: StaffRole[]) {
  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    roles,
  })
}

function createTeacherRepos(): SchoolRepositories {
  const accessRole = new AccessRole({
    id: systemAccessRoleId('school-1', StaffRole.Teacher),
    schoolId: 'school-1',
    name: StaffRole.Teacher,
    isSystemRole: true,
    systemRoleKey: StaffRole.Teacher,
    permissions: SYSTEM_ROLE_PERMISSIONS[StaffRole.Teacher],
  })
  const assignment = new StaffRoleAssignment({
    id: systemRoleAssignmentId('school-1', 'staff-1'),
    staffId: 'staff-1',
    schoolId: 'school-1',
    roleIds: [accessRole.id],
    scopeGrants: [],
  })

  return {
    staffMembers: {
      findById: async () => ({
        id: 'staff-1',
        schoolId: 'school-1',
        isActive: true,
      }),
    },
    staffAssignments: {
      list: async () => [],
    },
    accessRoles: {
      findById: async (id: string) => id === accessRole.id ? accessRole : undefined,
      findByIds: async (ids: string[]) => ids.includes(accessRole.id) ? [accessRole] : [],
      list: async () => [accessRole],
      save: async () => {},
    },
    staffRoleAssignments: {
      findById: async (id: string) => id === assignment.id ? assignment : undefined,
      findByIds: async (ids: string[]) => ids.includes(assignment.id) ? [assignment] : [],
      list: async () => [assignment],
      save: async () => {},
    },
  } as unknown as SchoolRepositories
}

describe('permission catalog', () => {
  test('defines metadata for every permission', () => {
    for (const permission of Object.values(Permission)) {
      expect(permissionDefinitions[permission].permission).toBe(permission)
      expect(permissionDefinitions[permission].allowedScopes.length).toBeGreaterThan(0)
    }
  })
})

describe('authorize', () => {
  test('allows teachers to record attendance through effective grants', async () => {
    const repos = createTeacherRepos()
    const policy = new RepositoryAuthorizationPolicy({ repositories: repos })
    const actor = staffActor([StaffRole.Teacher])

    await expect(authorize({
      actor,
      policy,
      repositories: repos,
      request: {
        actorId: actor.staffMemberId,
        schoolId: 'school-1',
        permission: Permission.ATTENDANCE_RECORD,
      },
    })).resolves.toBeUndefined()
  })

  test('rejects teachers for finance permissions', async () => {
    const repos = createTeacherRepos()
    const policy = new RepositoryAuthorizationPolicy({ repositories: repos })
    const actor = staffActor([StaffRole.Teacher])

    await expect(authorize({
      actor,
      policy,
      request: {
        actorId: actor.staffMemberId,
        schoolId: 'school-1',
        permission: Permission.PAYMENT_RECORD,
      },
    })).rejects.toBeInstanceOf(AuthorizationError)

    await expect(authorize({
      actor,
      policy,
      repositories: repos,
      request: {
        actorId: actor.staffMemberId,
        schoolId: 'school-1',
        permission: Permission.PAYMENT_RECORD,
      },
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects scope types not allowed for the permission', async () => {
    const policy = noopPolicy()
    const actor = staffActor([StaffRole.Admin])

    await expect(authorize({
      actor,
      policy,
      request: {
        actorId: actor.staffMemberId,
        schoolId: 'school-1',
        permission: Permission.PAYMENT_RECORD,
        scopeType: 'class_group',
        scopeEntityId: 'class-1',
      },
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects school mismatch', async () => {
    const policy = noopPolicy()
    const actor = staffActor([StaffRole.Admin])

    await expect(authorize({
      actor,
      policy,
      request: {
        actorId: actor.staffMemberId,
        schoolId: 'school-other',
        permission: Permission.ATTENDANCE_READ,
      },
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects staff authorization without repositories or preloaded grants', async () => {
    const policy = noopPolicy()
    const actor = staffActor([StaffRole.Admin])

    await expect(authorize({
      actor,
      policy,
      request: {
        actorId: actor.staffMemberId,
        schoolId: 'school-1',
        permission: Permission.STAFF_READ,
      },
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('permissionAction uses preloaded grants', async () => {
    const policy = noopPolicy()
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      roles: [StaffRole.Teacher],
      effectiveGrants: {
        permissions: new Set([Permission.ATTENDANCE_RECORD]),
        scopeGrants: [{
          permission: Permission.ATTENDANCE_RECORD,
          scopeType: 'school',
          scopeEntityIds: ['school-1'],
        }],
        isElevated: false,
      },
    })

    await expect(permissionAction(policy, Permission.ATTENDANCE_RECORD, {
      scopeType: 'school',
      scopeEntityId: 'school-1',
    })(actor)).resolves.toBeUndefined()
  })

  test('anyPermissionAction allows one matching permission gate', async () => {
    const policy = noopPolicy()
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      roles: [StaffRole.Accountant],
      effectiveGrants: {
        permissions: new Set([Permission.PAYMENT_READ]),
        scopeGrants: [{
          permission: Permission.PAYMENT_READ,
          scopeType: 'school',
          scopeEntityIds: ['school-1'],
        }],
        isElevated: false,
      },
    })

    await expect(anyPermissionAction(policy, [
      Permission.PAYMENT_RECORD,
      Permission.PAYMENT_READ,
    ])(actor)).resolves.toBeUndefined()
  })
})
