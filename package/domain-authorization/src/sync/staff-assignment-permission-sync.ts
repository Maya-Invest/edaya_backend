import type { StaffAssignment } from '@edaya/core'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import { StaffPermissionAssignment } from '@edaya/core'
import {
  resolveStaffAssignmentTarget,
  scopeIdsForStaffAssignmentPermission,
  validateStaffAssignmentPermissionSelection,
} from './staff-assignment-permission-rules'

function hasStaffPermissionAssignmentRepository(
  repositories: AuthorizationRepositories,
): repositories is AuthorizationRepositories & {
  staffPermissionAssignments: AuthorizationRepositories['staffPermissionAssignments']
} {
  return 'staffPermissionAssignments' in repositories
    && repositories.staffPermissionAssignments !== undefined
}

export async function deleteSyncedStaffAssignmentPermissions(
  assignmentId: string,
  repositories: AuthorizationRepositories,
): Promise<void> {
  if (!hasStaffPermissionAssignmentRepository(repositories)) {
    return
  }

  const derived = await repositories.staffPermissionAssignments.list({
    sourceStaffAssignmentId: assignmentId,
  })

  await Promise.all(derived.map(row => repositories.staffPermissionAssignments.delete(row.id)))
}

export async function syncStaffAssignmentPermissions(
  assignment: StaffAssignment,
  repositories: AuthorizationRepositories,
  now: Date = new Date(),
): Promise<void> {
  if (!hasStaffPermissionAssignmentRepository(repositories)) {
    return
  }

  await deleteSyncedStaffAssignmentPermissions(assignment.id, repositories)

  if (assignment.permissions.length === 0) {
    return
  }

  const target = await resolveStaffAssignmentTarget(assignment, repositories)
  validateStaffAssignmentPermissionSelection(assignment, target)

  const uniquePermissions = [...new Set(assignment.permissions)]
  for (const permission of uniquePermissions) {
    const scopeIds = scopeIdsForStaffAssignmentPermission(permission, target)

    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: `${assignment.id}:${permission}`,
      staffId: assignment.staffId,
      schoolId: target.schoolId,
      academicYearId: assignment.academicYearId,
      permission,
      scopeIds,
      status: 'active',
      sourceStaffAssignmentId: assignment.id,
      createdAt: now,
    }))
  }
}
