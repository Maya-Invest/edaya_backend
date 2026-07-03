import type { PermissionDefinition } from './permission-definition'
import type { ScopeType } from './scope-type'
import { Permission } from './permission'

function buildDefinition(
  permission: Permission,
  scope?: ScopeType,
): PermissionDefinition {
  return scope ? { permission, scope } : { permission }
}

const PERMISSION_SCOPE_OVERRIDES: Partial<Record<Permission, ScopeType>> = {
  // Class-group scoped
  [Permission.ACADEMIC_PROGRAM_READ]: 'class_group',
  [Permission.ACADEMIC_PROGRAM_UPDATE]: 'class_group',
  [Permission.ACADEMIC_PROGRAM_ASSIGN]: 'class_group',
  [Permission.QUERY_CLASS_DIRECTORY_READ]: 'class_group',
  [Permission.QUERY_CLASS_CURRICULUM_READ]: 'class_group',
  [Permission.ATTENDANCE_READ]: 'class_group',
  [Permission.GRADE_READ]: 'class_group',
  [Permission.TIMETABLE_READ]: 'class_group',
  [Permission.TIMETABLE_CREATE]: 'class_group',
  [Permission.TIMETABLE_UPDATE]: 'class_group',
  [Permission.CLASS_LOGBOOK_READ]: 'class_group',
  [Permission.COMMUNICATION_SEND]: 'class_group',
  [Permission.QUERY_ATTENDANCE_READ]: 'class_group',
  [Permission.QUERY_TIMETABLE_READ]: 'class_group',
  [Permission.QUERY_CURRICULUM_PROGRESS_READ]: 'class_group',

  // Class-subject scoped (teaching)
  [Permission.GRADE_INPUT]: 'class_subject',
  [Permission.GRADE_UPDATE]: 'class_subject',
  [Permission.ATTENDANCE_RECORD]: 'class_subject',
  [Permission.CLASS_LOGBOOK_CREATE]: 'class_subject',
  [Permission.CLASS_LOGBOOK_UPDATE]: 'class_subject',
  [Permission.DISCIPLINE_CREATE]: 'class_subject',
  [Permission.EXAM_CONFIG_CREATE]: 'class_subject',
  [Permission.EXAM_CONFIG_UPDATE]: 'class_subject',
  [Permission.EXAM_CONFIG_READ]: 'class_subject',

  // Portal query surfaces (computed grants; catalog marks student scope)
  [Permission.QUERY_STUDENT_DETAIL_READ]: 'student',
  [Permission.QUERY_ENROLLMENT_HISTORY_READ]: 'student',
  [Permission.QUERY_REPORT_CARD_DETAIL_READ]: 'student',
  [Permission.QUERY_COMMUNICATIONS_READ]: 'student',
  [Permission.QUERY_CALENDAR_READ]: 'student',
  [Permission.QUERY_OVERDUE_FEES_READ]: 'student',
  [Permission.QUERY_GUARDIAN_SELF_READ]: 'student',

  // Platform bootstrap
  [Permission.PLATFORM_REGISTER_SCHOOL]: 'platform',
}

export function buildPermissionDefinitions(): Record<Permission, PermissionDefinition> {
  const definitions = {} as Record<Permission, PermissionDefinition>
  for (const permission of Object.values(Permission)) {
    definitions[permission] = buildDefinition(permission, PERMISSION_SCOPE_OVERRIDES[permission])
  }
  return definitions
}
