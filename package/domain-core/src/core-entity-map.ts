import type {
  AcademicPeriod,
  AcademicYear,
  AccessRole,
  AccountInvitation,
  ActivityEnrollment,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  Attachment,
  AttendanceRecord,
  CalendarEvent,
  ClassGroup,
  ClassLogbookEntry,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  DisciplinaryAction,
  ExtracurricularActivity,
  Fee,
  GradeLevel,
  GradeScale,
  Guardian,
  GuardianStudentLink,
  HomeworkAssignment,
  HomeworkSubmission,
  Incident,
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
  Session,
  StaffAssignment,
  StaffMember,
  StaffRoleAssignment,
  Student,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentHealthProfile,
  StudentIncidentInvolvement,
  StudentNote,
  Subject,
  SubjectMatter,
} from './domains'

export interface CoreEntityMap {
  schools: School
  academicYears: AcademicYear
  academicPeriods: AcademicPeriod
  periodDefinitions: PeriodDefinition
  gradeLevels: GradeLevel
  staffMembers: StaffMember
  staffAssignments: StaffAssignment
  accessRoles: AccessRole
  accountInvitations: AccountInvitation
  staffRoleAssignments: StaffRoleAssignment
  attachments: Attachment
  resources: Resource
  resourceAssignments: ResourceAssignment
  fees: Fee
  studentFees: StudentFee
  payments: Payment
  schedules: Schedule
  sessions: Session
  calendarEvents: CalendarEvent
  attendance: AttendanceRecord
  announcements: Announcement
  announcementTargets: AnnouncementTarget
  messageDeliveries: MessageDelivery
  subjects: Subject
  subjectMatters: SubjectMatter
  classGroups: ClassGroup
  classSubjects: ClassSubject
  classSubjectMatters: ClassSubjectMatter
  classSubjectProgress: ClassSubjectProgress
  classLogbookEntries: ClassLogbookEntry
  homeworkAssignments: HomeworkAssignment
  homeworkSubmissions: HomeworkSubmission
  activities: ExtracurricularActivity
  activityEnrollments: ActivityEnrollment
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
  'accessRoles',
  'accountInvitations',
  'staffRoleAssignments',
  'attachments',
  'resources',
  'resourceAssignments',
  'fees',
  'studentFees',
  'payments',
  'schedules',
  'sessions',
  'calendarEvents',
  'attendance',
  'announcements',
  'announcementTargets',
  'messageDeliveries',
  'subjects',
  'subjectMatters',
  'classGroups',
  'classSubjects',
  'classSubjectMatters',
  'classSubjectProgress',
  'classLogbookEntries',
  'homeworkAssignments',
  'homeworkSubmissions',
  'activities',
  'activityEnrollments',
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
