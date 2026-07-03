import type { PermissionDefinition } from './permission-definition'
import type { ScopeType } from './scope-type'
import { Permission } from './permission'

const SCHOOL_ONLY: readonly ScopeType[] = ['school']
const SCHOOL_AND_YEAR: readonly ScopeType[] = ['school', 'academic_year']
const CLASS_SCOPED: readonly ScopeType[] = ['school', 'class_group', 'course_assignment', 'session']
const TEACHING_SCOPED: readonly ScopeType[] = ['school', 'class_group', 'course_assignment']

function buildDefinition(
  permission: Permission,
  allowedScopes: readonly ScopeType[] = SCHOOL_ONLY,
): PermissionDefinition {
  return {
    permission,
    allowedScopes,
  }
}

const ALLOWED_SCOPE_OVERRIDES: Partial<Record<Permission, readonly ScopeType[]>> = {
  [Permission.GRADE_INPUT]: TEACHING_SCOPED,
  [Permission.ATTENDANCE_RECORD]: [...TEACHING_SCOPED, 'session'],
  [Permission.PAYMENT_RECORD]: SCHOOL_ONLY,
  [Permission.COMMUNICATION_SEND]: ['school', 'class_group', 'student_group'],
  [Permission.ACADEMIC_PROGRAM_READ]: ['school', 'academic_year', 'class_group'],
  [Permission.ACADEMIC_PROGRAM_UPDATE]: ['school', 'academic_year', 'class_group'],
  [Permission.ENROLLMENT_CREATE]: SCHOOL_AND_YEAR,
  [Permission.STUDENT_READ]: ['school', 'class_group', 'student'],
  [Permission.ATTENDANCE_READ]: CLASS_SCOPED,
  [Permission.GRADE_READ]: CLASS_SCOPED,
  [Permission.TIMETABLE_READ]: CLASS_SCOPED,
  [Permission.TIMETABLE_CREATE]: CLASS_SCOPED,
  [Permission.TIMETABLE_UPDATE]: CLASS_SCOPED,
  [Permission.QUERY_STUDENT_DETAIL_READ]: ['school', 'student'],
}

export function buildPermissionDefinitions(): Record<Permission, PermissionDefinition> {
  const definitions = {} as Record<Permission, PermissionDefinition>
  for (const permission of Object.values(Permission)) {
    definitions[permission] = buildDefinition(permission, ALLOWED_SCOPE_OVERRIDES[permission])
  }
  return definitions
}
