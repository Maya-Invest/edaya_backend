import type { AcademicPeriodInput, AcademicYearInput, ActivityEnrollmentInput, ActivityInput, AnnouncementInput, AnnouncementTargetInput, AssessmentInput, AssessmentResultInput, AttachmentInput, AttendanceRecordInput, CalendarEventKind, CatalogEnrollmentMode, CatalogServiceCategory, CatalogServiceStatus, ClassActivityEnrollmentInput, ClassGroupInput, ClassSubjectInput, DayOfWeek, DisciplinaryActionInput, GradeLevelInput, GradeScaleInput, GuardianInput, GuardianStudentLinkInput, IncidentInput, MessageDeliveryInput, PaymentMethod, PeriodDefinitionInput, ReportCardDefinitionInput, ReportCardDefinitionSectionRole, ResourceAssignmentInput, ResourceInput, ScheduleInput, SchoolInput, StaffAssignmentInput, StaffMemberInput, StudentClassEnrollmentInput, StudentDisciplinaryActionInput, StudentHealthProfileInput, StudentIncidentInvolvementInput, StudentInput, StudentNoteInput, SubjectInput, SubjectMatterInput, TeacherAssignmentInput, TeacherInput } from '@edaya/core'

export type FixtureDatasetPurpose = 'minimal' | 'integration' | 'demo' | 'demo-ci' | 'bulk'

export interface FixtureAttendanceSession {
  session: {
    scheduleId: string
    classGroupId: string
    classSubjectId: string
    title: string
    date: string
    startTime: string
    endTime: string
  }
  records: readonly AttendanceRecordInput[]
}

/** Daily roll-call occurrence for classes with attendanceMode=daily. Empty map = unmarked day. */
export interface FixtureDailyAttendanceDay {
  classGroupId: string
  date: string
  attendanceByStudent: Readonly<Record<string, AttendanceRecordInput['status']>>
}

export interface FixtureSchedulingSlot {
  slotId: string
  schedule: ScheduleInput
  /** Portal teacher (Teacher entity id) responsible for this slot. */
  teacherId: string
  /** Staff member assigned to the materialized lesson session; omit for portal-only teachers. */
  lessonSessionStaffId?: string
  resourceId?: string
}

export interface FixtureSchedulingSessionProgressAnchor {
  progress: {
    id: string
    classSubjectMatterId: string
    completedPercentage: number
    notes: string
  }
  scheduleId: string
  dayOfWeek: DayOfWeek
  recordedAtTime: string
}

export interface FixtureCalendarEvent {
  id: string
  title: string
  startDate: string
  endDate: string
  description: string
  kind: CalendarEventKind
  isNonSchoolDay: boolean
  scope: 'school' | readonly string[]
}

export interface FixtureReportCardSection {
  id: string
  name: string
  role: ReportCardDefinitionSectionRole
  order: number
  weight: number
  coefficient?: number
  subjectIds: readonly string[]
}

export interface FixtureReportCardGradeScale {
  scale: GradeScaleInput
  narrativePassingScore: number
}

export interface FixtureReportCardDefinition {
  definition: ReportCardDefinitionInput
  sections: readonly FixtureReportCardSection[]
  narrativeStatus: 'published' | 'draft'
}

export interface FixtureReportCardSubjectMark {
  subjectId: string
  average: number
  coefficient: number
  appreciation: string
}

export interface FixtureReportCardResult {
  id: string
  studentId: string
  classGroupId: string
  periodId: string
  reportCardDefinitionId: string
  gradeScaleId: string
  narrativeStatus: 'published' | 'generated'
  overallAverage: number
  classRank: number
  classSize: number
  homeroomComment: string
  principalComment?: string
  generatedAt: string
  publishedAt?: string
  sectionMarks: Record<string, readonly FixtureReportCardSubjectMark[]>
}

export interface FixtureAnnouncementMaterializePlan {
  announcementId: string
}

export interface FixtureCatalogInstallment {
  label: string
  percentage: number
  dueDate?: string
}

export interface FixtureCatalogBillingTerms {
  kind: 'one_time'
  installments: readonly FixtureCatalogInstallment[]
  singleDueDate?: string
}

/** Seed-oriented catalog offering. Charges are materialized from enrollments, not stored here. */
export interface FixtureCatalogService {
  id: string
  academicYearId: string
  name: string
  description?: string
  category?: CatalogServiceCategory
  enrollmentMode?: CatalogEnrollmentMode
  defaultPrice: number
  currency: string
  billingTerms: FixtureCatalogBillingTerms
  status?: CatalogServiceStatus
}

export interface FixtureStudentServiceEnrollment {
  id: string
  studentId: string
  catalogServiceId: string
  priceOverride?: number
  dueDate?: string
  waive?: {
    reason: string
    waiverAmount?: number
  }
  cancelCharge?: {
    reason: string
  }
}

export type FixtureAllocationPlan
  = { mode: 'account_only' }
    | { mode: 'fifo' }
    | { mode: 'targeted', targets: readonly { chargeId: string, amount: number }[] }

/** Seed-oriented receipt. Not a raw Payment entity (no studentFeeId / accountId required). */
export interface FixturePayment {
  id: string
  studentId?: string
  academicYearId?: string
  accountId?: string
  amount: number
  paymentDate: string
  method: PaymentMethod
  reference?: string
  notes?: string
  allocation?: FixtureAllocationPlan
  reverseCausedAllocations?: boolean | { chargeIds: readonly string[] }
  reversePayment?: boolean
  refund?: {
    id: string
    amount: number
    paymentDate: string
    method: PaymentMethod
    reference?: string
    notes?: string
  }
}

export interface FixtureDatasetExtensions {
  assessmentResultScores?: Record<string, Partial<Record<string, number>>>
  attendanceSessions?: {
    absenceSessions: readonly FixtureAttendanceSession[]
    todaySession: FixtureAttendanceSession
    pendingJustificationRecordIds: readonly string[]
  }
  dailyAttendanceDays?: readonly FixtureDailyAttendanceDay[]
  schedulingSlots?: readonly FixtureSchedulingSlot[]
  schedulingSessionProgressAnchor?: FixtureSchedulingSessionProgressAnchor
  schedulingSessionProgressAnchors?: readonly FixtureSchedulingSessionProgressAnchor[]
  calendarEvents?: readonly FixtureCalendarEvent[]
  reportCardGradeScaleFixtures?: readonly FixtureReportCardGradeScale[]
  reportCardDefinitionFixtures?: readonly FixtureReportCardDefinition[]
  reportCardResults?: readonly FixtureReportCardResult[]
  announcementMaterializePlans?: readonly FixtureAnnouncementMaterializePlan[]
  classSubjectStaffAssignments?: readonly StaffAssignmentInput[]
  classResourceAssignments?: readonly ResourceAssignmentInput[]
  /** When true, schedules may still be created but lesson sessions are not materialized (timetable generation QA). */
  skipLessonSessionSeeding?: boolean
}

export interface FixtureDatasetEntities {
  school?: SchoolInput
  academicYear?: AcademicYearInput
  academicPeriods?: readonly AcademicPeriodInput[]
  gradeLevels?: readonly GradeLevelInput[]
  periodDefinitions?: readonly PeriodDefinitionInput[]
  classGroups?: readonly ClassGroupInput[]
  staffMembers?: readonly StaffMemberInput[]
  teachers?: readonly TeacherInput[]
  teacherAssignments?: readonly TeacherAssignmentInput[]
  guardians?: readonly GuardianInput[]
  students?: readonly StudentInput[]
  enrollments?: readonly StudentClassEnrollmentInput[]
  guardianLinks?: readonly GuardianStudentLinkInput[]
  subjects?: readonly SubjectInput[]
  subjectMatters?: readonly SubjectMatterInput[]
  classSubjects?: readonly ClassSubjectInput[]
  resources?: readonly ResourceInput[]
  schedules?: readonly ScheduleInput[]
  inClassAssessments?: readonly AssessmentInput[]
  homeworkAssessments?: readonly AssessmentInput[]
  homeworkSubmissions?: readonly AssessmentResultInput[]
  attendanceRecords?: readonly AttendanceRecordInput[]
  activities?: readonly ActivityInput[]
  activityEnrollments?: readonly ActivityEnrollmentInput[]
  classActivityEnrollments?: readonly ClassActivityEnrollmentInput[]
  catalogServices?: readonly FixtureCatalogService[]
  studentServiceEnrollments?: readonly FixtureStudentServiceEnrollment[]
  payments?: readonly FixturePayment[]
  announcements?: readonly AnnouncementInput[]
  announcementTargets?: readonly AnnouncementTargetInput[]
  messageDeliveries?: readonly MessageDeliveryInput[]
  incidents?: readonly IncidentInput[]
  studentIncidentInvolvements?: readonly StudentIncidentInvolvementInput[]
  disciplinaryActions?: readonly DisciplinaryActionInput[]
  studentDisciplinaryActions?: readonly StudentDisciplinaryActionInput[]
  gradeScales?: readonly GradeScaleInput[]
  attachments?: readonly AttachmentInput[]
  studentHealthProfiles?: readonly StudentHealthProfileInput[]
  studentNotes?: readonly StudentNoteInput[]
}

export interface FixtureDataset<P extends FixtureDatasetPurpose = FixtureDatasetPurpose> {
  purpose: P
  schoolId: string
  entities: FixtureDatasetEntities
  extensions?: FixtureDatasetExtensions
}
