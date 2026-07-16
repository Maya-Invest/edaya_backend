import type { EffectiveGrants } from '@edaya/authorization'
import { ACCOUNTANT_PERMISSIONS, COORDINATOR_PERMISSIONS, Permission } from '@edaya/authorization'

/** Staff teaching-write permissions used in auth test fixtures. */
const STAFF_TEACHING_WRITE_TEST_PERMISSIONS: readonly Permission[] = [
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.ATTENDANCE_RECORD,
  Permission.DISCIPLINE_CREATE,
  Permission.GRADE_INPUT,
  Permission.CLASS_LOGBOOK_UPDATE,
]

export type TestRole = 'admin' | 'principal' | 'teacher' | 'accountant' | 'counselor' | 'coordinator' | 'supervisor'

export const TEST_ROLE_PERMISSIONS: Record<TestRole, readonly Permission[]> = {
  admin: Object.values(Permission).filter(p => p !== Permission.PLATFORM_REGISTER_SCHOOL),
  principal: Object.values(Permission).filter(p => p !== Permission.PLATFORM_REGISTER_SCHOOL),
  coordinator: COORDINATOR_PERMISSIONS,
  accountant: ACCOUNTANT_PERMISSIONS,
  teacher: STAFF_TEACHING_WRITE_TEST_PERMISSIONS,
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
