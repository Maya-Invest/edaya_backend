import type { EffectiveGrants } from '@edaya/authorization'
import type { GuardianScope, StudentScope } from '../../src/model/actor-scope'
import {
  ACCOUNTANT_PERMISSIONS,
  ASSIGNMENT_SCOPED_PERMISSIONS,
  COORDINATOR_PERMISSIONS,
  Permission,
} from '@edaya/authorization'

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

const fixtureScopeEntityIds = {
  school: ['school', 'school-1'],
  class_group: ['class', 'class-1', 'teacher-class', 'unassigned-class'],
  course_assignment: ['class-subject', 'class-subject-1', 'class-math'],
  session: ['session', 'lesson', 'active-session'],
  student: ['student', 'student-1', 'student-note', 'student-health', 'student-health-verified'],
} as const

export function portalScopeForStudent(
  studentId: string,
  classGroupId: string = 'class-1',
): StudentScope {
  return {
    studentId,
    classGroupId,
  }
}

export function portalScopeForGuardian(
  studentIds: readonly string[],
  classGroupIds: readonly string[] = ['class-1'],
): GuardianScope {
  return {
    studentIds: [...studentIds],
    classGroupIds: [...classGroupIds],
  }
}

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
