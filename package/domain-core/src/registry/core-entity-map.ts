import type {
  AcademicDiscipline,
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
  CatalogService,
  ClassActivityEnrollment,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  DisciplinaryAction,
  DocumentIssuance,
  GradeLevel,
  GradeScale,
  Guardian,
  GuardianStudentLink,
  Incident,
  LessonSession,
  MessageDelivery,
  Payment,
  PeriodDefinition,
  PlacementStatus,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardResult,
  Resource,
  ResourceAssignment,
  Schedule,
  School,
  SchoolNotificationTemplates,
  StaffAssignment,
  StaffManualPermissionAssignment,
  StaffMember,
  StaffPermissionAssignment,
  StaffPermissionProfile,
  StaffPermissionProfileBinding,
  StaffPermissionScopeDefaults,
  Student,
  StudentAcademicYearProfile,
  StudentCharge,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentHealthProfile,
  StudentIncidentInvolvement,
  StudentNote,
  StudentPhotoSubmission,
  StudentServiceEnrollment,
  StudentSubjectEnrollment,
  StudentYearAccount,
  Subject,
  SubjectCategoryEntity,
  SubjectMatter,
  Teacher,
  TeacherAcademicYearProfile,
  TeacherAssignment,
  TeacherUnavailability,
} from '../domain'

export interface CoreEntityMap {
  academicDisciplines: AcademicDiscipline
  placementStatuses: PlacementStatus
  studentAcademicYearProfiles: StudentAcademicYearProfile
  teacherAcademicYearProfiles: TeacherAcademicYearProfile

  schools: School
  academicYears: AcademicYear
  academicPeriods: AcademicPeriod
  periodDefinitions: PeriodDefinition
  gradeLevels: GradeLevel
  staffMembers: StaffMember
  staffAssignments: StaffAssignment
  teachers: Teacher
  teacherAssignments: TeacherAssignment
  teacherUnavailabilities: TeacherUnavailability
  accountInvitations: AccountInvitation
  staffPermissionAssignments: StaffPermissionAssignment
  staffPermissionProfiles: StaffPermissionProfile
  staffPermissionProfileBindings: StaffPermissionProfileBinding
  staffManualPermissionAssignments: StaffManualPermissionAssignment
  staffPermissionScopeDefaults: StaffPermissionScopeDefaults
  attachments: Attachment
  resources: Resource
  resourceAssignments: ResourceAssignment
  catalogServices: CatalogService
  studentServiceEnrollments: StudentServiceEnrollment
  studentCharges: StudentCharge
  studentYearAccounts: StudentYearAccount
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
  subjectCategories: SubjectCategoryEntity
  subjectMatters: SubjectMatter
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
  subjectEnrollments: StudentSubjectEnrollment
  enrollments: StudentClassEnrollment
  guardians: Guardian
  guardianLinks: GuardianStudentLink
  studentNotes: StudentNote
  studentPhotoSubmissions: StudentPhotoSubmission
  studentHealthProfiles: StudentHealthProfile
  studentDisciplinaryActions: StudentDisciplinaryAction
  disciplinaryActions: DisciplinaryAction
  studentIncidentInvolvements: StudentIncidentInvolvement
  incidents: Incident
  documentIssuances: DocumentIssuance
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
  'academicDisciplines',
  'placementStatuses',
  'studentAcademicYearProfiles',
  'teacherAcademicYearProfiles',

  'schools',
  'academicYears',
  'academicPeriods',
  'periodDefinitions',
  'gradeLevels',
  'staffMembers',
  'staffAssignments',
  'teachers',
  'teacherAssignments',
  'teacherUnavailabilities',
  'accountInvitations',
  'staffPermissionAssignments',
  'staffPermissionProfiles',
  'staffPermissionProfileBindings',
  'staffManualPermissionAssignments',
  'staffPermissionScopeDefaults',
  'attachments',
  'resources',
  'resourceAssignments',
  'catalogServices',
  'studentServiceEnrollments',
  'studentCharges',
  'studentYearAccounts',
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
  'subjectCategories',
  'subjectMatters',
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
  'subjectEnrollments',
  'enrollments',
  'guardians',
  'guardianLinks',
  'studentNotes',
  'studentPhotoSubmissions',
  'studentHealthProfiles',
  'studentDisciplinaryActions',
  'disciplinaryActions',
  'studentIncidentInvolvements',
  'incidents',
  'documentIssuances',
] as const)
