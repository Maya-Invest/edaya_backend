/** Fixed read capabilities for student portal actors (self-scoped degenerate guardian). */
export enum StudentCapability {
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

export const ALL_STUDENT_CAPABILITIES: readonly StudentCapability[] = Object.freeze(
  Object.values(StudentCapability),
)
