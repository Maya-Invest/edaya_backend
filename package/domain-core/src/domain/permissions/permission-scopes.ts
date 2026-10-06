import type { ScopeType } from './scope-type'
import { Permission } from './permission'

/** Catalog scope grain per permission (tenant-wide when omitted). */
export const PERMISSION_SCOPE_OVERRIDES: Partial<Record<Permission, ScopeType>> = {
  [Permission.ACADEMIC_PROGRAM_READ]: 'class_group',
  [Permission.ACADEMIC_PROGRAM_UPDATE]: 'class_group',
  [Permission.ACADEMIC_PROGRAM_ASSIGN]: 'class_group',
  [Permission.QUERY_CLASS_DIRECTORY_READ]: 'class_group',
  [Permission.QUERY_CLASS_CURRICULUM_READ]: 'class_group',
  [Permission.ATTENDANCE_READ]: 'class_group',
  [Permission.GRADE_READ]: 'class_group',
  [Permission.GRADE_VALIDATE]: 'class_group',
  [Permission.GRADE_UNLOCK]: 'class_group',
  [Permission.TIMETABLE_READ]: 'class_group',
  [Permission.TIMETABLE_CREATE]: 'class_group',
  [Permission.TIMETABLE_UPDATE]: 'class_group',
  [Permission.CLASS_LOGBOOK_READ]: 'class_group',
  [Permission.COMMUNICATION_SEND]: 'class_group',
  [Permission.QUERY_ATTENDANCE_READ]: 'class_group',
  [Permission.QUERY_TIMETABLE_READ]: 'class_group',
  [Permission.QUERY_CURRICULUM_PROGRESS_READ]: 'class_group',
  [Permission.GRADE_INPUT]: 'class_group',
  [Permission.GRADE_UPDATE]: 'class_group',
  [Permission.ATTENDANCE_RECORD]: 'class_group',
  [Permission.CLASS_LOGBOOK_CREATE]: 'class_group',
  [Permission.CLASS_LOGBOOK_UPDATE]: 'class_group',
  [Permission.DISCIPLINE_CREATE]: 'class_group',
  [Permission.EXAM_CONFIG_CREATE]: 'class_subject',
  [Permission.EXAM_CONFIG_UPDATE]: 'class_subject',
  [Permission.EXAM_CONFIG_READ]: 'class_subject',
  [Permission.QUERY_STUDENT_DETAIL_READ]: 'student',
  [Permission.QUERY_ENROLLMENT_HISTORY_READ]: 'student',
  [Permission.QUERY_REPORT_CARD_DETAIL_READ]: 'student',
  [Permission.QUERY_COMMUNICATIONS_READ]: 'student',
  [Permission.QUERY_CALENDAR_READ]: 'student',
  [Permission.QUERY_OVERDUE_FEES_READ]: 'student',
  [Permission.QUERY_GUARDIAN_SELF_READ]: 'student',
  [Permission.PLATFORM_USER_READ]: 'platform',
  [Permission.PLATFORM_USER_CREATE]: 'platform',
  [Permission.PLATFORM_USER_DEACTIVATE]: 'platform',
  [Permission.S2S_CLIENT_READ]: 'platform',
  [Permission.S2S_CLIENT_CREATE]: 'platform',
  [Permission.S2S_CLIENT_REVOKE]: 'platform',
  [Permission.S2S_CLIENT_ROTATE_KEY]: 'platform',
  [Permission.PLATFORM_REGISTER_SCHOOL]: 'platform',
}

export function permissionScope(permission: Permission): ScopeType | undefined {
  return PERMISSION_SCOPE_OVERRIDES[permission]
}
