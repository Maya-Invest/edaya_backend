import { ASSIGNMENT_SCOPED_PERMISSIONS } from '../../permissions/assignment-scoped-permissions'
import { Permission } from '../../permissions/permission'

/** Permissions checked for direct student-level resource access. */
export const STUDENT_DIRECT_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.STUDENT_READ,
  Permission.STUDENT_UPDATE,
  Permission.PAYMENT_READ,
]

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

/** Permissions that satisfy timetable query and session read module checks. */
export const TIMETABLE_ACCESS_PERMISSIONS: readonly Permission[] = [
  ...SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS,
  ...ASSIGNMENT_SCOPED_PERMISSIONS,
]

/** Permissions that satisfy assessment read module checks. */
export const ASSESSMENT_ACCESS_PERMISSIONS: readonly Permission[] = [
  ...SCHOOL_WIDE_ASSESSMENT_ACCESS_PERMISSIONS,
  ...ASSIGNMENT_SCOPED_PERMISSIONS,
]

/** Permissions that satisfy class-subject read module checks. */
export const CLASS_SUBJECT_READ_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_CLASS_CURRICULUM_READ,
  Permission.ACADEMIC_PROGRAM_READ,
  ...ASSIGNMENT_SCOPED_PERMISSIONS,
]

/** Permissions that satisfy curriculum-linked read module checks (matters, chapters). */
export const CURRICULUM_READ_PERMISSIONS: readonly Permission[] = [
  ...CLASS_SUBJECT_READ_PERMISSIONS,
  Permission.QUERY_CURRICULUM_PROGRESS_READ,
]

/** Permissions that satisfy logbook read module checks. */
export const LOGBOOK_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.CLASS_LOGBOOK_READ,
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.CLASS_LOGBOOK_UPDATE,
  Permission.GRADE_INPUT,
]

/** Permissions that satisfy attendance read module checks. */
export const ATTENDANCE_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_RECORD,
  Permission.ATTENDANCE_UPDATE,
  Permission.ATTENDANCE_JUSTIFY,
]

/** Permissions that satisfy enrollment read module checks. */
export const ENROLLMENT_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.ENROLLMENT_READ,
  Permission.STUDENT_READ,
  ...ASSIGNMENT_SCOPED_PERMISSIONS,
]

export const GUARDIAN_ADMIN_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
  Permission.PARENT_READ,
  Permission.PARENT_UPDATE,
]

export const TEACHER_ADMIN_ACCESS_PERMISSIONS: readonly Permission[] = [
  Permission.ACCESS_CONTROL_ASSIGN,
  Permission.SCHOOL_STRUCTURE_CONFIGURE,
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
