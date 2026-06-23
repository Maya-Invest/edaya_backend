import { Permission } from './permission'

/**
 * Single registry for permission groups used by grant resolution and policy resolvers.
 * Add new groups here rather than duplicating lists across modules.
 */

/** Permissions derived from `StaffAssignment` rows (class / course / session). */
export const ASSIGNMENT_SCOPED_PERMISSIONS: readonly Permission[] = [
  Permission.GRADE_INPUT,
  Permission.ATTENDANCE_RECORD,
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.CLASS_LOGBOOK_UPDATE,
  Permission.DISCIPLINE_CREATE,
]

export const ASSIGNMENT_SCOPED_PERMISSION_SET = new Set(ASSIGNMENT_SCOPED_PERMISSIONS)

/** Permissions checked for direct student-level resource access. */
export const STUDENT_DIRECT_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.STUDENT_READ,
  Permission.STUDENT_UPDATE,
  Permission.PAYMENT_READ,
]

export const CLASS_GROUP_TEACHING_ACCESS_PERMISSIONS = ASSIGNMENT_SCOPED_PERMISSIONS
export const SESSION_TEACHING_ACCESS_PERMISSIONS = ASSIGNMENT_SCOPED_PERMISSIONS

/** Permissions that satisfy `checkClassGroupAccess`. */
export const CLASS_GROUP_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.ACADEMIC_PROGRAM_READ,
  Permission.ACADEMIC_PROGRAM_UPDATE,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  ...ASSIGNMENT_SCOPED_PERMISSIONS,
  Permission.GRADE_READ,
  Permission.CLASS_LOGBOOK_READ,
  Permission.ATTENDANCE_READ,
]

export const SCHOOL_WIDE_ASSESSMENT_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.GRADE_READ,
  Permission.EXAM_CONFIG_CONFIGURE,
  Permission.QUERY_CURRICULUM_PROGRESS_READ,
]

export const SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_TIMETABLE_READ,
  Permission.TIMETABLE_UPDATE,
  Permission.TIMETABLE_CREATE,
]

export const GUARDIAN_ADMIN_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
  Permission.PARENT_READ,
  Permission.PARENT_UPDATE,
]

export const SCHOOL_WIDE_STUDENT_NOTE_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.CLASS_LOGBOOK_READ,
]

export const FEE_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.FINANCIAL_CONFIG_READ,
  Permission.PAYMENT_READ,
  Permission.QUERY_WORKSPACE_READ,
]

export const STUDENT_FEE_STAFF_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.PAYMENT_READ,
  Permission.PAYMENT_RECORD,
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.QUERY_WORKSPACE_READ,
]
