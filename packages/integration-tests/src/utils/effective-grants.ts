import type { EffectiveGrants } from '@edaya/core'
import {
  ACCOUNTANT_PERMISSIONS,
  COORDINATOR_PERMISSIONS,
  Permission,
  TEACHER_PERMISSIONS,
} from '@edaya/core'

export type TestRole = 'admin' | 'principal' | 'teacher' | 'accountant' | 'counselor' | 'coordinator' | 'supervisor'

export const TEST_ROLE_PERMISSIONS: Record<TestRole, readonly Permission[]> = {
  admin: Object.values(Permission).filter(p => p !== Permission.PLATFORM_REGISTER_SCHOOL),
  principal: Object.values(Permission).filter(p => p !== Permission.PLATFORM_REGISTER_SCHOOL),
  coordinator: COORDINATOR_PERMISSIONS,
  accountant: ACCOUNTANT_PERMISSIONS,
  teacher: TEACHER_PERMISSIONS,
  counselor: [],
  supervisor: [],
}

const TEST_ELEVATED_ROLES = new Set<TestRole>(['admin', 'principal'])

export function effectiveGrantsForRoles(roles: readonly TestRole[]): EffectiveGrants {
  const permissions = new Set(roles.flatMap(role => [...TEST_ROLE_PERMISSIONS[role]]))
  return {
    permissions,
    scopeGrants: [...permissions].map(permission => ({
      permission,
      scopeType: 'school',
      scopeEntityIds: ['school'],
    })),
    isElevated: roles.some(role => TEST_ELEVATED_ROLES.has(role)),
  }
}
