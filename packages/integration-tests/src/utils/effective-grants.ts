import type { EffectiveGrants, StaffRole } from '@edaya/core'
import { ELEVATED_STAFF_ROLES, SYSTEM_ROLE_PERMISSIONS } from '@edaya/core'

export function effectiveGrantsForRoles(roles: readonly StaffRole[]): EffectiveGrants {
  const permissions = new Set(roles.flatMap(role => [...SYSTEM_ROLE_PERMISSIONS[role]]))
  return {
    permissions,
    scopeGrants: [...permissions].map(permission => ({
      permission,
      scopeType: 'school',
      scopeEntityIds: ['school'],
    })),
    isElevated: roles.some(role => ELEVATED_STAFF_ROLES.has(role)),
  }
}
