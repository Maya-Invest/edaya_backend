import type {
  AcademicPeriod,
  AcademicYear,
  AccountInvitation,
  Activity,
  ActivityEnrollment,
  ActivitySession,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  Attachment,
  Attendance,
  AttendanceRecord,
  CalendarEvent,
  ClassActivityEnrollment,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  DisciplinaryAction,
  Fee,
  GradeLevel,
  GradeLevelSubject,
  GradeLevelSubjectMatter,
  GradeScale,
  Guardian,
  GuardianStudentLink,
  Incident,
  LessonSession,
  MessageDelivery,
  Payment,
  PeriodDefinition,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardResult,
  Resource,
  ResourceAssignment,
  Schedule,
  School,
  SchoolNotificationTemplates,
  StaffAssignment,
  StaffMember,
  StaffPermissionAssignment,
  Student,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentHealthProfile,
  StudentIncidentInvolvement,
  StudentNote,
  Subject,
  SubjectMatter,
  Teacher,
  TeacherAssignment,
} from '../../domain'

export interface CoreEntityMap {
  schools: School
  academicYears: AcademicYear
  academicPeriods: AcademicPeriod
  periodDefinitions: PeriodDefinition
  gradeLevels: GradeLevel
  staffMembers: StaffMember
  staffAssignments: StaffAssignment
  teachers: Teacher
  teacherAssignments: TeacherAssignment
  accountInvitations: AccountInvitation
  staffPermissionAssignments: StaffPermissionAssignment
  attachments: Attachment
  resources: Resource
  resourceAssignments: ResourceAssignment
  fees: Fee
  studentFees: StudentFee
  payments: Payment
  schedules: Schedule
  lessonSessions: LessonSession
  activitySessions: ActivitySession
  attendances: Attendance
  calendarEvents: CalendarEvent
  attendance: AttendanceRecord
  announcements: Announcement
  announcementTargets: AnnouncementTarget
  messageDeliveries: MessageDelivery
  schoolNotificationTemplates: SchoolNotificationTemplates
  subjects: Subject
  subjectMatters: SubjectMatter
  gradeLevelSubjects: GradeLevelSubject
  gradeLevelSubjectMatters: GradeLevelSubjectMatter
  classGroups: ClassGroup
  classSubjects: ClassSubject
  classSubjectMatters: ClassSubjectMatter
  classSubjectProgress: ClassSubjectProgress
  activities: Activity
  activityEnrollments: ActivityEnrollment
  classActivityEnrollments: ClassActivityEnrollment
  assessments: Assessment
  assessmentResults: AssessmentResult
  gradeScales: GradeScale
  definitions: ReportCardDefinition
  sections: ReportCardDefinitionSection
  results: ReportCardResult
  students: Student
  enrollments: StudentClassEnrollment
  guardians: Guardian
  guardianLinks: GuardianStudentLink
  studentNotes: StudentNote
  studentHealthProfiles: StudentHealthProfile
  studentDisciplinaryActions: StudentDisciplinaryAction
  disciplinaryActions: DisciplinaryAction
  studentIncidentInvolvements: StudentIncidentInvolvement
  incidents: Incident
}

export type CoreEntityKey = keyof CoreEntityMap

function defineCoreEntityKeys<const Keys extends readonly CoreEntityKey[]>(
  keys: Keys & (
    Exclude<CoreEntityKey, Keys[number]> extends never
      ? unknown
      : readonly ['Missing core entity keys', Exclude<CoreEntityKey, Keys[number]>]
  ),
): Keys {
  return keys
}

export const CORE_ENTITY_KEYS = defineCoreEntityKeys([
  'schools',
  'academicYears',
  'academicPeriods',
  'periodDefinitions',
  'gradeLevels',
  'staffMembers',
  'staffAssignments',
  'teachers',
  'teacherAssignments',
  'accountInvitations',
  'staffPermissionAssignments',
  'attachments',
  'resources',
  'resourceAssignments',
  'fees',
  'studentFees',
  'payments',
  'schedules',
  'lessonSessions',
  'activitySessions',
  'attendances',
  'calendarEvents',
  'attendance',
  'announcements',
  'announcementTargets',
  'messageDeliveries',
  'schoolNotificationTemplates',
  'subjects',
  'subjectMatters',
  'gradeLevelSubjects',
  'gradeLevelSubjectMatters',
  'classGroups',
  'classSubjects',
  'classSubjectMatters',
  'classSubjectProgress',
  'activities',
  'activityEnrollments',
  'classActivityEnrollments',
  'assessments',
  'assessmentResults',
  'gradeScales',
  'definitions',
  'sections',
  'results',
  'students',
  'enrollments',
  'guardians',
  'guardianLinks',
  'studentNotes',
  'studentHealthProfiles',
  'studentDisciplinaryActions',
  'disciplinaryActions',
  'studentIncidentInvolvements',
  'incidents',
] as const)
