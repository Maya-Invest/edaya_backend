import type { StaffRoleAssignment } from '../../../src/entities/school/staff-role-assignment'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  ensureSystemAccessRolesForSchool,
  Permission,
  resolveEffectiveGrants,
  syncStaffSystemRoleAssignment,
  systemAccessRoleId,
  TEACHER_PERMISSIONS,
} from '../../../src/authorization'
import { AccessRole, StaffMember, StaffRole } from '../../../src/entities'
import { StaffAssignment } from '../../../src/entities/school/staff-assignment'

function createRepos(): SchoolRepositories {
  const staff = new StaffMember({
    id: 'staff-1',
    schoolId: 'school-1',
    firstName: 'Ada',
    lastName: 'Teacher',
  })

  const roleStore = new Map<string, AccessRole>()
  const assignmentStore = new Map<string, StaffRoleAssignment>()

  return {
    staffMembers: {
      findById: mock(async () => staff),
      list: mock(async () => [staff]),
    },
    staffAssignments: {
      list: mock(async () => [
        new StaffAssignment({
          id: 'assign-1',
          staffId: 'staff-1',
          role: StaffRole.Teacher,
          classGroupId: 'class-1',
        }),
      ]),
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
      list: mock(async () => [...assignmentStore.values()]),
      save: mock(async (entity: StaffRoleAssignment) => {
        assignmentStore.set(entity.id, entity)
      }),
    },
  } as unknown as SchoolRepositories
}

describe('access control persistence', () => {
  test('ensureSystemAccessRolesForSchool creates one role per StaffRole', async () => {
    const repos = createRepos()
    const roles = await ensureSystemAccessRolesForSchool('school-1', repos)

    expect(roles.length).toBe(Object.values(StaffRole).length)
    expect(roles.some(role => role.id === systemAccessRoleId('school-1', StaffRole.Teacher))).toBe(true)
    expect(repos.accessRoles.save).toHaveBeenCalled()
  })

  test('sync persists assignment and resolveEffectiveGrants uses it', async () => {
    const repos = createRepos()

    roleStoreSeed(repos)

    await syncStaffSystemRoleAssignment({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories: repos,
      roleKeys: [StaffRole.Teacher],
    })

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories: repos,
    })

    expect(grants.permissions.has(Permission.ATTENDANCE_RECORD)).toBe(true)
    expect(repos.staffRoleAssignments.save).toHaveBeenCalled()
  })
})

async function roleStoreSeed(repos: SchoolRepositories): Promise<void> {
  await repos.accessRoles.save(new AccessRole({
    id: systemAccessRoleId('school-1', StaffRole.Teacher),
    schoolId: 'school-1',
    name: 'Enseignant',
    isSystemRole: true,
    systemRoleKey: StaffRole.Teacher,
    permissions: [...TEACHER_PERMISSIONS],
  }))
}
