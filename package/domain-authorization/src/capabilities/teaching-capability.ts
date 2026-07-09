/** Subject-scoped capabilities for assigned class subjects. */
export enum TeachingCapability {
  RecordSessionAttendance = 'RecordSessionAttendance',
  CreateSubjectAssessment = 'CreateSubjectAssessment',
  UpdateSubjectAssessment = 'UpdateSubjectAssessment',
  InputGrade = 'InputGrade',
  CreateLogbookEntry = 'CreateLogbookEntry',
  UpdateLogbookEntry = 'UpdateLogbookEntry',
  CreateSubjectDisciplineIncident = 'CreateSubjectDisciplineIncident',
  ReadSubjectRoster = 'ReadSubjectRoster',
  ReadSubjectTimetable = 'ReadSubjectTimetable',
  ReadSubjectAssessments = 'ReadSubjectAssessments',
  ReadSubjectGrades = 'ReadSubjectGrades',
  ReadSubjectAttendance = 'ReadSubjectAttendance',
  ReadSubjectLogbook = 'ReadSubjectLogbook',
  ReadSubjectCurriculum = 'ReadSubjectCurriculum',
  ReadSubjectReportCard = 'ReadSubjectReportCard',
  WriteSubjectReportComment = 'WriteSubjectReportComment',
}

export const ALL_TEACHING_CAPABILITIES: readonly TeachingCapability[] = Object.freeze(
  Object.values(TeachingCapability),
)
