import { ASSIGNMENT_SCOPED_PERMISSIONS } from '../grants/system-role-permissions'
import { Permission } from '../permissions/permission'

/** Permissions checked for direct student-level resource access. */
export const STUDENT_DIRECT_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.STUDENT_READ,
  Permission.STUDENT_UPDATE,
  Permission.PAYMENT_READ,
]

/**
 * Teaching permissions that grant student access via the student's active class group.
 * Aligned with `ASSIGNMENT_SCOPED_PERMISSIONS`.
 */
export const CLASS_GROUP_TEACHING_ACCESS_PERMISSIONS = ASSIGNMENT_SCOPED_PERMISSIONS

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

/** School-wide permissions that short-circuit assessment access checks. */
export const SCHOOL_WIDE_ASSESSMENT_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.GRADE_READ,
  Permission.EXAM_CONFIG_CONFIGURE,
  Permission.QUERY_CURRICULUM_PROGRESS_READ,
]

/** School-wide permissions that short-circuit session access checks. */
export const SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_TIMETABLE_READ,
  Permission.TIMETABLE_UPDATE,
  Permission.TIMETABLE_CREATE,
]

/** Session-scoped teaching permissions for `checkSessionAccess`. */
export const SESSION_TEACHING_ACCESS_PERMISSIONS = ASSIGNMENT_SCOPED_PERMISSIONS

/** Guardian admin permissions for `checkGuardianAccess`. */
export const GUARDIAN_ADMIN_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
  Permission.PARENT_READ,
  Permission.PARENT_UPDATE,
]

/** School-wide student note permissions for `checkStudentNoteAccess`. */
export const SCHOOL_WIDE_STUDENT_NOTE_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.CLASS_LOGBOOK_READ,
]
