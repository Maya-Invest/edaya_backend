/** Class-scoped capabilities for homeroom assignments. */
export enum HomeroomCapability {
  ReadClassRoster = 'ReadClassRoster',
  RecordDailyAttendance = 'RecordDailyAttendance',
  ReadClassAttendance = 'ReadClassAttendance',
  WriteHomeroomReportComment = 'WriteHomeroomReportComment',
  WriteGroupReportComment = 'WriteGroupReportComment',
  CreateClassDisciplineIncident = 'CreateClassDisciplineIncident',
  ReadClassGradesOverview = 'ReadClassGradesOverview',
  ReadClassTimetable = 'ReadClassTimetable',
  ReadClassLogbook = 'ReadClassLogbook',
  SendClassCommunication = 'SendClassCommunication',
}

export const ALL_HOMEROOM_CAPABILITIES: readonly HomeroomCapability[] = Object.freeze(
  Object.values(HomeroomCapability),
)
