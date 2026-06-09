import type { EffectiveGrants } from '../../src/authorization'
import {
  ACCOUNTANT_PERMISSIONS,
  ASSIGNMENT_SCOPED_PERMISSIONS,
  COORDINATOR_PERMISSIONS,
  Permission,
  TEACHER_PERMISSIONS,
} from '../../src/authorization'

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

const fixtureScopeEntityIds = {
  school: ['school', 'school-1'],
  class_group: ['class', 'class-1', 'teacher-class', 'unassigned-class'],
  course_assignment: ['class-subject', 'class-subject-1', 'class-math'],
  session: ['session', 'lesson', 'active-session'],
  student: ['student', 'student-1', 'student-note', 'student-health', 'student-health-verified'],
} as const

export function effectiveGrantsForRoles(roles: readonly TestRole[]): EffectiveGrants {
  const permissions = new Set(roles.flatMap(role => [...TEST_ROLE_PERMISSIONS[role]]))
  return {
    permissions,
    scopeGrants: [...permissions].flatMap(permission =>
      Object.entries(fixtureScopeEntityIds)
        .filter(([scopeType]) => {
          if (roles.includes('teacher') && ASSIGNMENT_SCOPED_PERMISSIONS.includes(permission) && scopeType === 'school') {
            return false
          }
          return true
        })
        .map(([scopeType, scopeEntityIds]) => ({
          permission,
          scopeType: scopeType as keyof typeof fixtureScopeEntityIds,
          scopeEntityIds: [...scopeEntityIds],
        }))),
    isElevated: roles.some(role => TEST_ELEVATED_ROLES.has(role)),
  }
}
