import type { StaffRoleAssignment } from '../../../src/domains'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  AuthorizationError,
  ELEVATED_STAFF_PERMISSIONS,
  Permission,
  resolveEffectiveGrants,
  scopeGrantCovers,
} from '../../../src/authorization'
import { AccessRole, School, StaffRoleAssignment as StaffRoleAssignmentEntity } from '../../../src/domains'

function createRepos(assignments: unknown[] = [], ownerSubjectId?: string, staffSubjectId?: string): SchoolRepositories {
  const roleStore = new Map<string, AccessRole>()
  const assignmentStore = new Map<string, StaffRoleAssignment>()

  return {
    schools: {
      findById: mock(async () => new School({
        id: 'school-1',
        name: 'School',
        timeZone: 'UTC',
        ownerSubjectId,
      })),
    },
    staffMembers: {
      findById: mock(async () => ({
        id: 'staff-1',
        schoolId: 'school-1',
        subjectId: staffSubjectId,
        isActive: true,
      })),
    },
    staffAssignments: {
      list: mock(async () => assignments),
    },
    accessRoles: {
      findById: mock(async (id: string) => roleStore.get(id)),
      findByIds: mock(async (ids: string[]) => ids.map(id => roleStore.get(id)).filter(Boolean) as AccessRole[]),
      save: mock(async (entity: AccessRole) => {
        roleStore.set(entity.id, entity)
      }),
      list: mock(async () => [...roleStore.values()]),
    },
    staffRoleAssignments: {
      findById: mock(async (id: string) => assignmentStore.get(id)),
      findByIds: mock(async (ids: string[]) => ids.map(id => assignmentStore.get(id)).filter(Boolean) as StaffRoleAssignment[]),
      save: mock(async (entity: StaffRoleAssignment) => {
        assignmentStore.set(entity.id, entity)
      }),
      list: mock(async () => [...assignmentStore.values()]),
    },
  } as unknown as SchoolRepositories
}

describe('resolveEffectiveGrants', () => {
  test('grants school owner full school-scoped access without role assignments', async () => {
    const repositories = createRepos([], 'subject-owner', 'subject-owner')

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
    })

    expect(grants.isElevated).toBe(true)
    expect(grants.permissions.has(Permission.SCHOOL_LIFECYCLE_MANAGE)).toBe(true)
    expect(grants.permissions.has(Permission.PLATFORM_REGISTER_SCHOOL)).toBe(false)
    expect(grants.permissions.size).toBe(ELEVATED_STAFF_PERMISSIONS.length)
  })

  test('grants staff permissions with school scope', async () => {
    const repositories = createRepos()
    await repositories.accessRoles.save(new AccessRole({
      id: 'role-admin',
      schoolId: 'school-1',
      name: 'Admin',
      permissions: [Permission.PAYMENT_RECORD],
    }))
    await repositories.staffRoleAssignments.save(new StaffRoleAssignmentEntity({
      id: 'assignment-admin',
      staffId: 'staff-1',
      schoolId: 'school-1',
      roleIds: ['role-admin'],
      scopeGrants: [
        {
          permission: Permission.PAYMENT_RECORD,
          scopeType: 'school',
          scopeEntityIds: ['school-1'],
        },
      ],
      status: 'active',
    }))

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
    })

    expect(grants.isElevated).toBe(false)
    expect(grants.permissions.has(Permission.PAYMENT_RECORD)).toBe(true)
    expect(scopeGrantCovers(grants.scopeGrants, {
      permission: Permission.PAYMENT_RECORD,
      schoolId: 'school-1',
      isElevated: grants.isElevated,
    })).toBe(true)
  })

  test('grants teacher assignment-scoped permissions from staff assignments', async () => {
    const repositories = createRepos([
      { id: 'a-1', staffId: 'staff-1', classGroupId: 'class-1' },
    ])
    await repositories.accessRoles.save(new AccessRole({
      id: 'role-teacher',
      schoolId: 'school-1',
      name: 'Teacher',
      permissions: [Permission.ATTENDANCE_RECORD],
    }))
    await repositories.staffRoleAssignments.save(new StaffRoleAssignmentEntity({
      id: 'assignment-teacher',
      staffId: 'staff-1',
      schoolId: 'school-1',
      roleIds: ['role-teacher'],
      scopeGrants: [],
      status: 'active',
    }))

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
    })

    expect(grants.permissions.has(Permission.ATTENDANCE_RECORD)).toBe(true)
    expect(scopeGrantCovers(grants.scopeGrants, {
      permission: Permission.ATTENDANCE_RECORD,
      schoolId: 'school-1',
      scopeType: 'class_group',
      scopeEntityId: 'class-1',
      isElevated: grants.isElevated,
    })).toBe(true)
    expect(scopeGrantCovers(grants.scopeGrants, {
      permission: Permission.ATTENDANCE_RECORD,
      schoolId: 'school-1',
      scopeType: 'class_group',
      scopeEntityId: 'class-2',
      isElevated: grants.isElevated,
    })).toBe(false)
  })

  test('does not grant finance permissions to teachers', async () => {
    const repositories = createRepos()
    await repositories.accessRoles.save(new AccessRole({
      id: 'role-teacher',
      schoolId: 'school-1',
      name: 'Teacher',
      permissions: [Permission.ATTENDANCE_RECORD],
    }))
    await repositories.staffRoleAssignments.save(new StaffRoleAssignmentEntity({
      id: 'assignment-teacher',
      staffId: 'staff-1',
      schoolId: 'school-1',
      roleIds: ['role-teacher'],
      scopeGrants: [],
      status: 'active',
    }))

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
    })

    expect(grants.permissions.has(Permission.PAYMENT_RECORD)).toBe(false)
  })

  test('grants split payment permissions to accountants', async () => {
    const repositories = createRepos()
    await repositories.accessRoles.save(new AccessRole({
      id: 'role-accountant',
      schoolId: 'school-1',
      name: 'Accountant',
      permissions: [
        Permission.PAYMENT_RECORD,
        Permission.PAYMENT_CANCEL,
        Permission.PAYMENT_REVERSE,
        Permission.FINANCIAL_CONFIG_READ,
        Permission.FINANCIAL_CONFIG_CONFIGURE,
        Permission.FINANCIAL_CONFIG_UPDATE,
      ],
    }))
    await repositories.staffRoleAssignments.save(new StaffRoleAssignmentEntity({
      id: 'assignment-accountant',
      staffId: 'staff-1',
      schoolId: 'school-1',
      roleIds: ['role-accountant'],
      scopeGrants: [],
      status: 'active',
    }))

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
    })

    expect(grants.permissions.has(Permission.PAYMENT_RECORD)).toBe(true)
    expect(grants.permissions.has(Permission.PAYMENT_CANCEL)).toBe(true)
    expect(grants.permissions.has(Permission.PAYMENT_REVERSE)).toBe(true)
    expect(grants.permissions.has(Permission.FINANCIAL_CONFIG_READ)).toBe(true)
    expect(grants.permissions.has(Permission.FINANCIAL_CONFIG_CONFIGURE)).toBe(true)
    expect(grants.permissions.has(Permission.FINANCIAL_CONFIG_UPDATE)).toBe(true)
  })

  test('ignores active assignments outside their validity window', async () => {
    const repositories = createRepos()
    await repositories.accessRoles.save(new AccessRole({
      id: 'role-accountant',
      schoolId: 'school-1',
      name: 'Comptable',
      permissions: [Permission.PAYMENT_READ],
    }))
    await repositories.staffRoleAssignments.save(new StaffRoleAssignmentEntity({
      id: 'future-assignment',
      staffId: 'staff-1',
      schoolId: 'school-1',
      roleIds: ['role-accountant'],
      scopeGrants: [],
      status: 'active',
      startsAt: new Date('2026-02-01T00:00:00Z'),
    }))

    await expect(resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
      now: new Date('2026-01-01T00:00:00Z'),
    })).rejects.toThrow()
  })

  test('reports earliest assignment expiry for cache bounds', async () => {
    const repositories = createRepos()
    await repositories.accessRoles.save(new AccessRole({
      id: 'role-accountant',
      schoolId: 'school-1',
      name: 'Comptable',
      permissions: [Permission.PAYMENT_READ],
    }))
    await repositories.staffRoleAssignments.save(new StaffRoleAssignmentEntity({
      id: 'temporary-assignment',
      staffId: 'staff-1',
      schoolId: 'school-1',
      roleIds: ['role-accountant'],
      scopeGrants: [],
      status: 'active',
      endsAt: new Date('2026-01-02T00:00:00Z'),
    }))

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
      now: new Date('2026-01-01T00:00:00Z'),
    })

    expect(grants.expiresAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z')
  })

  test('rejects grant resolution if no database assignments exist', async () => {
    const repositories = createRepos()
    await expect(resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
