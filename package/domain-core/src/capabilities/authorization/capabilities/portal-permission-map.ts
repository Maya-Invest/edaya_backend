import { Permission } from '../permissions/permission'
import { GuardianCapability } from './guardian-capability'
import { StudentCapability } from './student-capability'

const GUARDIAN_PERMISSION_CAPABILITY_MAP: Partial<Record<Permission, GuardianCapability>> = {
  [Permission.QUERY_GUARDIAN_SELF_READ]: GuardianCapability.ReadSelfProfile,
  [Permission.QUERY_WORKSPACE_READ]: GuardianCapability.ReadWorkspaceShell,
  [Permission.QUERY_CLASS_DIRECTORY_READ]: GuardianCapability.ReadWorkspaceShell,
  [Permission.ATTENDANCE_READ]: GuardianCapability.ReadAttendance,
  [Permission.PAYMENT_READ]: GuardianCapability.ReadPayments,
  [Permission.QUERY_STUDENT_DETAIL_READ]: GuardianCapability.ReadStudentDetail,
  [Permission.QUERY_REPORT_CARD_DETAIL_READ]: GuardianCapability.ReadReportCard,
  [Permission.QUERY_ENROLLMENT_HISTORY_READ]: GuardianCapability.ReadEnrollmentHistory,
  [Permission.GRADE_READ]: GuardianCapability.ReadGrades,
  [Permission.CLASS_LOGBOOK_READ]: GuardianCapability.ReadLogbook,
  [Permission.QUERY_TIMETABLE_READ]: GuardianCapability.ReadTimetable,
  [Permission.QUERY_CALENDAR_READ]: GuardianCapability.ReadCalendar,
  [Permission.QUERY_COMMUNICATIONS_READ]: GuardianCapability.ReadCommunications,
  [Permission.QUERY_CLASS_CURRICULUM_READ]: GuardianCapability.ReadCurriculum,
}

const STUDENT_PERMISSION_CAPABILITY_MAP: Partial<Record<Permission, StudentCapability>> = {
  [Permission.QUERY_WORKSPACE_READ]: StudentCapability.ReadWorkspaceShell,
  [Permission.QUERY_CLASS_DIRECTORY_READ]: StudentCapability.ReadWorkspaceShell,
  [Permission.ATTENDANCE_READ]: StudentCapability.ReadAttendance,
  [Permission.PAYMENT_READ]: StudentCapability.ReadPayments,
  [Permission.QUERY_STUDENT_DETAIL_READ]: StudentCapability.ReadStudentDetail,
  [Permission.QUERY_REPORT_CARD_DETAIL_READ]: StudentCapability.ReadReportCard,
  [Permission.QUERY_ENROLLMENT_HISTORY_READ]: StudentCapability.ReadEnrollmentHistory,
  [Permission.GRADE_READ]: StudentCapability.ReadGrades,
  [Permission.CLASS_LOGBOOK_READ]: StudentCapability.ReadLogbook,
  [Permission.QUERY_TIMETABLE_READ]: StudentCapability.ReadTimetable,
  [Permission.QUERY_CALENDAR_READ]: StudentCapability.ReadCalendar,
  [Permission.QUERY_COMMUNICATIONS_READ]: StudentCapability.ReadCommunications,
  [Permission.QUERY_CLASS_CURRICULUM_READ]: StudentCapability.ReadCurriculum,
}

export function guardianCapabilityForPermission(permission: Permission): GuardianCapability | undefined {
  return GUARDIAN_PERMISSION_CAPABILITY_MAP[permission]
}

export function studentCapabilityForPermission(permission: Permission): StudentCapability | undefined {
  return STUDENT_PERMISSION_CAPABILITY_MAP[permission]
}
