import type { StaffRole } from '../../domains'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { Permission } from '../permissions/permission'
import { StaffRoleAssignment } from '../../domains'
import { mergeScopeGrants, scopeGrantsFromStaffAssignments } from '../../ports/authorization-repository'
import { ASSIGNMENT_SCOPED_PERMISSIONS, ELEVATED_STAFF_ROLES } from '../system-role-permissions'
import { ensureSystemAccessRolesForSchool } from './ensure-system-roles'
import { systemAccessRoleId } from './system-role-ids'

export interface SyncStaffSystemRoleAssignmentArgs {
  staffMemberId: string
  schoolId: string
  repositories: SchoolRepositories
  roleKeys?: readonly StaffRole[]
  assignmentId?: string
}

/**
 * Creates or refreshes the system-role assignment for a staff member.
 *
 * `roleKeys` is required when creating the assignment. Later syncs reuse the
 * persisted role ids and only refresh status / scope grants from current staff
 * assignments.
 */
export async function syncStaffSystemRoleAssignment(
  args: SyncStaffSystemRoleAssignmentArgs,
): Promise<StaffRoleAssignment | undefined> {
  const { staffMemberId, schoolId, repositories } = args
  const staffMember = await repositories.staffMembers.findById(staffMemberId)
  if (!staffMember || staffMember.schoolId !== schoolId) {
    throw new Error(`Unknown staff member "${staffMemberId}" for school "${schoolId}"`)
  }

  await ensureSystemAccessRolesForSchool(schoolId, repositories)

  const assignmentId = args.assignmentId ?? systemRoleAssignmentId(schoolId, staffMemberId)
  const existing = await repositories.staffRoleAssignments.findById(assignmentId)
  const roleIds = args.roleKeys
    ? [...new Set(args.roleKeys)].map(role => systemAccessRoleId(schoolId, role))
    : existing?.roleIds

  if (!roleIds || roleIds.length === 0) {
    return undefined
  }

  const roles = await repositories.accessRoles.findByIds([...roleIds])
  const permissions = new Set<Permission>()
  for (const role of roles) {
    for (const permission of role.permissions) {
      permissions.add(permission)
    }
  }

  const roleKeys = roles
    .map(role => role.systemRoleKey)
    .filter((role): role is StaffRole => role !== undefined)
  const isElevated = roleKeys.some(role => ELEVATED_STAFF_ROLES.has(role))
  const scopeGrants = []

  if (isElevated) {
    for (const permission of permissions) {
      scopeGrants.push({
        permission,
        scopeType: 'school' as const,
        scopeEntityIds: [schoolId],
      })
    }
  }
  else {
    for (const permission of permissions) {
      if (!ASSIGNMENT_SCOPED_PERMISSIONS.includes(permission)) {
        scopeGrants.push({
          permission,
          scopeType: 'school' as const,
          scopeEntityIds: [schoolId],
        })
      }
    }
    const teachingAssignments = await repositories.staffAssignments.list({ staffId: staffMemberId })
    scopeGrants.push(...scopeGrantsFromStaffAssignments(teachingAssignments))
  }

  const assignment = new StaffRoleAssignment({
    id: assignmentId,
    staffId: staffMemberId,
    schoolId,
    roleIds,
    scopeGrants: mergeScopeGrants(scopeGrants),
    status: staffMember.isActive ? 'active' : 'inactive',
    createdAt: existing?.createdAt,
  })

  await repositories.staffRoleAssignments.save(assignment)
  return assignment
}

export async function syncSchoolStaffSystemRoleAssignments(
  schoolId: string,
  repositories: SchoolRepositories,
): Promise<readonly StaffRoleAssignment[]> {
  await ensureSystemAccessRolesForSchool(schoolId, repositories)
  const staffMembers = await repositories.staffMembers.list({ schoolId })
  const results: StaffRoleAssignment[] = []

  for (const staffMember of staffMembers) {
    const assignment = await syncStaffSystemRoleAssignment({
      staffMemberId: staffMember.id,
      schoolId,
      repositories,
    })
    if (assignment) {
      results.push(assignment)
    }
  }

  return results
}

export function systemRoleAssignmentId(schoolId: string, staffMemberId: string): string {
  return `role_assignment:${schoolId}:${staffMemberId}`
}
