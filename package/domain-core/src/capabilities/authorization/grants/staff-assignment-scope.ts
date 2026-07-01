import type { StaffAssignment } from '../../../domain/school/staff-assignment'
import type { ScopeGrant } from '../model/scope-grant'
import { ASSIGNMENT_SCOPED_PERMISSIONS } from './system-role-permissions'

export function scopeGrantsFromStaffAssignments(
  assignments: readonly StaffAssignment[],
): ScopeGrant[] {
  const grants: ScopeGrant[] = []

  for (const assignment of assignments) {
    grants.push(...scopeGrantsFromStaffAssignment(assignment))
  }

  return grants
}

function scopeGrantsFromStaffAssignment(assignment: StaffAssignment): ScopeGrant[] {
  const grants: ScopeGrant[] = []

  if (assignment.classGroupId) {
    for (const permission of ASSIGNMENT_SCOPED_PERMISSIONS) {
      grants.push({
        permission,
        scopeType: 'class_group',
        scopeEntityIds: [assignment.classGroupId],
      })
    }
  }

  if (assignment.classSubjectId) {
    for (const permission of ASSIGNMENT_SCOPED_PERMISSIONS) {
      grants.push({
        permission,
        scopeType: 'course_assignment',
        scopeEntityIds: [assignment.classSubjectId],
      })
    }
  }

  if (assignment.sessionId) {
    for (const permission of ASSIGNMENT_SCOPED_PERMISSIONS) {
      grants.push({
        permission,
        scopeType: 'session',
        scopeEntityIds: [assignment.sessionId],
      })
    }
  }

  return grants
}
