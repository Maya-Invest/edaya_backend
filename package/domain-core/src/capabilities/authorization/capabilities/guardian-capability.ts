/** Fixed read capabilities for guardian portal actors. */
export enum GuardianCapability {
  ReadSelfProfile = 'ReadSelfProfile',
  ReadStudentDetail = 'ReadStudentDetail',
  ReadGrades = 'ReadGrades',
  ReadReportCard = 'ReadReportCard',
  ReadAttendance = 'ReadAttendance',
  ReadPayments = 'ReadPayments',
  ReadEnrollmentHistory = 'ReadEnrollmentHistory',
  ReadLogbook = 'ReadLogbook',
  ReadTimetable = 'ReadTimetable',
  ReadCalendar = 'ReadCalendar',
  ReadCommunications = 'ReadCommunications',
  ReadCurriculum = 'ReadCurriculum',
  ReadWorkspaceShell = 'ReadWorkspaceShell',
}

export const ALL_GUARDIAN_CAPABILITIES: readonly GuardianCapability[] = Object.freeze(
  Object.values(GuardianCapability),
)
