import type { EffectiveGrants } from '../../src/authorization'
import type { StaffRole } from '../../src/domains'
import { ELEVATED_STAFF_ROLES, SYSTEM_ROLE_PERMISSIONS } from '../../src/authorization'

const fixtureScopeEntityIds = {
  school: ['school', 'school-1'],
  class_group: ['class', 'class-1', 'teacher-class', 'unassigned-class'],
  course_assignment: ['class-subject', 'class-subject-1', 'class-math'],
  session: ['session', 'lesson', 'active-session'],
  student: ['student', 'student-1', 'student-note', 'student-health', 'student-health-verified'],
} as const

export function effectiveGrantsForRoles(roles: readonly StaffRole[]): EffectiveGrants {
  const permissions = new Set(roles.flatMap(role => [...SYSTEM_ROLE_PERMISSIONS[role]]))
  return {
    permissions,
    scopeGrants: [...permissions].flatMap(permission =>
      Object.entries(fixtureScopeEntityIds).map(([scopeType, scopeEntityIds]) => ({
        permission,
        scopeType: scopeType as keyof typeof fixtureScopeEntityIds,
        scopeEntityIds: [...scopeEntityIds],
      }))),
    isElevated: roles.some(role => ELEVATED_STAFF_ROLES.has(role)),
  }
}
