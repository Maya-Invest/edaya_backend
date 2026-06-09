import { Permission } from './permissions/permission'

/** Permissions granted to Admin / Principal (school-wide elevated staff). */
export const ELEVATED_STAFF_PERMISSIONS: readonly Permission[] = Object.values(Permission)
  .filter(permission => permission !== Permission.PLATFORM_REGISTER_SCHOOL)

export const COORDINATOR_PERMISSIONS: readonly Permission[] = [
  Permission.ACADEMIC_PROGRAM_UPDATE,
  Permission.SCHOOL_LIFECYCLE_MANAGE,
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.CLASS_LOGBOOK_READ,
  Permission.TIMETABLE_UPDATE,
  Permission.ATTENDANCE_RECORD,
  Permission.ATTENDANCE_JUSTIFY,
  Permission.ATTENDANCE_READ,
  Permission.DISCIPLINE_CREATE,
  Permission.DISCIPLINE_VALIDATE,
  Permission.DISCIPLINE_READ,
  Permission.RESOURCE_CONFIGURE,
  Permission.RESOURCE_READ,
  Permission.ATTACHMENT_CONFIGURE,
  Permission.ATTACHMENT_READ,
  Permission.EXAM_CONFIG_CONFIGURE,
  Permission.GRADE_INPUT,
  Permission.GRADE_READ,
  Permission.REPORT_CARD_PUBLISH,
  Permission.ENROLLMENT_CREATE,
  Permission.PARENT_UPDATE,
  Permission.STUDENT_UPDATE,
  Permission.STUDENT_HEALTH_READ,
  Permission.STUDENT_HEALTH_UPDATE,
  Permission.CLASS_LOGBOOK_UPDATE,
  Permission.COMMUNICATION_CREATE,
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.QUERY_REPORT_CARD_DETAIL_READ,
  Permission.QUERY_COMMUNICATIONS_READ,
  Permission.QUERY_CALENDAR_READ,
  Permission.QUERY_CURRICULUM_PROGRESS_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
  Permission.QUERY_TIMETABLE_READ,
  Permission.QUERY_ATTENDANCE_READ,
  Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
  Permission.TIMETABLE_CREATE,
]

export const TEACHER_PERMISSIONS: readonly Permission[] = [
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.ATTENDANCE_RECORD,
  Permission.DISCIPLINE_CREATE,
  Permission.GRADE_INPUT,
  Permission.CLASS_LOGBOOK_UPDATE,
]

export const ACCOUNTANT_PERMISSIONS: readonly Permission[] = [
  Permission.PAYMENT_RECORD,
  Permission.PAYMENT_READ,
  Permission.FINANCIAL_CONFIG_READ,
  Permission.FINANCIAL_CONFIG_CONFIGURE,
  Permission.FINANCIAL_CONFIG_UPDATE,
  Permission.PAYMENT_CANCEL,
  Permission.PAYMENT_REVERSE,
]

/**
 * Permissions derived from `StaffAssignment` rows (class / course / session).
 * Must stay aligned with teacher global actions that are scope-limited in resolvers.
 */
export const ASSIGNMENT_SCOPED_PERMISSIONS: readonly Permission[] = [
  Permission.GRADE_INPUT,
  Permission.ATTENDANCE_RECORD,
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.CLASS_LOGBOOK_UPDATE,
  Permission.DISCIPLINE_CREATE,
]


