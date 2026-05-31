import { z } from "@hono/zod-openapi";
import {
  AcademicPeriodType,
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementTargetKind,
  AssessmentKind,
  AttachmentOwnerKind,
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  ClassSubjectMatterStatus,
  DayOfWeek,
  DeadlineComplianceStatus,
  DisciplinaryActionKind,
  EnrollmentEndReason,
  FeeCategory,
  FeeStatus,
  IncidentInvolvementRole,
  IncidentKind,
  IncidentStatus,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
  PaymentMethod,
  PaymentStatus,
  ProgressionDecision,
  ReportCardDefinitionKind,
  ReportCardDefinitionSectionKind,
  ReportCardResultStatus,
  ResourceKind,
  SessionKind,
  StaffRole,
  StudentClassEnrollmentStatus,
  StudentDisciplinaryActionStatus,
  StudentNoteVisibility,
  StudentStatus,
} from "@edaya/core";
import type {
  AcademicPeriodArgs,
  AcademicYearArgs,
  AnnouncementArgs,
  AnnouncementTargetArgs,
  AssessmentArgs,
  AssessmentResultArgs,
  AttachmentArgs,
  AttendanceRecordArgs,
  AttendanceSummary,
  CalendarEventArgs,
  ClassGroupArgs,
  ClassSubjectArgs,
  ClassSubjectMatterArgs,
  ClassSubjectProgressArgs,
  DisciplinaryActionArgs,
  FeeArgs,
  FeeInstallmentTemplate,
  GradeLevelArgs,
  GradeScaleArgs,
  GradeScaleRange,
  GuardianArgs,
  GuardianStudentLinkArgs,
  IncidentArgs,
  MessageDeliveryArgs,
  PaymentArgs,
  PeriodDefinitionArgs,
  ReportCardDefinitionArgs,
  ReportCardDefinitionSectionArgs,
  ReportCardResultArgs,
  ReportCardResultSection,
  ResourceArgs,
  ResourceAssignmentArgs,
  ScheduleArgs,
  SchoolArgs,
  SessionArgs,
  StaffAssignmentArgs,
  StaffMemberArgs,
  StudentArgs,
  StudentClassEnrollmentArgs,
  StudentDisciplinaryActionArgs,
  StudentFeeArgs,
  StudentFeeInstallment,
  StudentHealthProfileArgs,
  StudentIncidentInvolvementArgs,
  StudentNoteArgs,
  SubjectArgs,
  SubjectMatterArgs,
} from "@edaya/core";
import { createQueryOptionsSchema } from "./query-options";

// ==========================================================
// 1. All 42 Domain Entities Response OpenAPI Schemas
// ==========================================================

export const schoolResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  timeZone: z.string(),
  createdAt: z.coerce.date(),
}).openapi("School") satisfies z.ZodType<SchoolArgs>;

export const academicYearResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  createdAt: z.coerce.date(),
}).openapi("AcademicYear") satisfies z.ZodType<AcademicYearArgs>;

export const academicPeriodResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string(),
  type: z.nativeEnum(AcademicPeriodType),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isPublished: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("AcademicPeriod") satisfies z.ZodType<AcademicPeriodArgs>;

export const periodDefinitionResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  label: z.string(),
  order: z.number().int().positive(),
  startTime: z.string(),
  endTime: z.string(),
  isBreak: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("PeriodDefinition") satisfies z.ZodType<PeriodDefinitionArgs>;

export const gradeLevelResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  order: z.number().int().positive(),
  cycle: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("GradeLevel") satisfies z.ZodType<GradeLevelArgs>;

export const staffMemberResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(z.nativeEnum(StaffRole)),
  email: z.string().email().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("StaffMember") satisfies z.ZodType<StaffMemberArgs>;

export const staffAssignmentResponseSchema = z.object({
  id: z.string().uuid(),
  staffId: z.string().uuid(),
  role: z.nativeEnum(StaffRole),
  classGroupId: z.string().uuid().nullable().optional(),
  classSubjectId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("StaffAssignment") satisfies z.ZodType<StaffAssignmentArgs>;

export const attachmentResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  ownerKind: z.nativeEnum(AttachmentOwnerKind),
  ownerId: z.string().uuid(),
  fileName: z.string(),
  fileUrl: z.string(),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  uploadedById: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Attachment") satisfies z.ZodType<AttachmentArgs>;

export const resourceResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  kind: z.nativeEnum(ResourceKind),
  capacity: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Resource") satisfies z.ZodType<ResourceArgs>;

export const resourceAssignmentResponseSchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid(),
  sessionId: z.string().uuid().nullable().optional(),
  classGroupId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("ResourceAssignment") satisfies z.ZodType<ResourceAssignmentArgs>;

export const feeInstallmentTemplateSchema = z.object({
  label: z.string(),
  percentage: z.number(),
  dueDate: z.coerce.date().nullable().optional(),
}) satisfies z.ZodType<FeeInstallmentTemplate>;

export const feeResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string(),
  category: z.nativeEnum(FeeCategory).optional(),
  description: z.string().nullable().optional(),
  defaultAmount: z.number(),
  currency: z.string(),
  installments: z.array(feeInstallmentTemplateSchema).optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Fee") satisfies z.ZodType<FeeArgs>;

export const studentFeeInstallmentSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  expectedAmount: z.number(),
  dueDate: z.coerce.date().nullable().optional(),
}) satisfies z.ZodType<StudentFeeInstallment>;

export const studentFeeResponseSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  feeId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  expectedAmount: z.number(),
  paidAmount: z.number().nullable().optional(),
  adjustmentAmount: z.number().nullable().optional(),
  adjustmentReason: z.string().nullable().optional(),
  adjustedById: z.string().uuid().nullable().optional(),
  adjustedAt: z.coerce.date().nullable().optional(),
  currency: z.string(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(FeeStatus),
  cancellationReason: z.string().nullable().optional(),
  cancelledById: z.string().uuid().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  installments: z.array(studentFeeInstallmentSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).openapi("StudentFee") satisfies z.ZodType<StudentFeeArgs>;

export const paymentResponseSchema = z.object({
  id: z.string().uuid(),
  studentFeeId: z.string().uuid(),
  amount: z.number(),
  currency: z.string(),
  paymentDate: z.coerce.date(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  recordedById: z.string().uuid().nullable().optional(),
  reversedAt: z.coerce.date().nullable().optional(),
  reversedById: z.string().uuid().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  cancelledById: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Payment") satisfies z.ZodType<PaymentArgs>;

export const scheduleResponseSchema = z.object({
  id: z.string().uuid(),
  classGroupId: z.string().uuid(),
  classSubjectId: z.string().uuid().nullable().optional(),
  title: z.string(),
  isRecurring: z.boolean(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  startTime: z.string(),
  endTime: z.string(),
  specificDate: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Schedule") satisfies z.ZodType<ScheduleArgs>;

export const sessionResponseSchema = z.object({
  id: z.string().uuid(),
  classGroupId: z.string().uuid(),
  title: z.string(),
  kind: z.nativeEnum(SessionKind),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  classSubjectId: z.string().uuid().nullable().optional(),
  scheduleId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Session") satisfies z.ZodType<SessionArgs>;

export const calendarEventResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  title: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  kind: z.nativeEnum(CalendarEventKind),
  isNonSchoolDay: z.boolean().optional(),
  scopeKind: z.nativeEnum(CalendarEventScopeKind).optional(),
  scopeId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("CalendarEvent") satisfies z.ZodType<CalendarEventArgs>;

export const attendanceResponseSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  date: z.coerce.date(),
  status: z.nativeEnum(AttendanceStatus),
  justificationStatus: z.nativeEnum(AttendanceJustificationStatus).optional(),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  justifiedAt: z.coerce.date().nullable().optional(),
  justifiedByStaffId: z.string().uuid().nullable().optional(),
  correctedAt: z.coerce.date().nullable().optional(),
  correctedByStaffId: z.string().uuid().nullable().optional(),
  createdBy: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).openapi("Attendance") satisfies z.ZodType<AttendanceRecordArgs>;

export const announcementResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  createdBy: z.string().optional(),
  status: z.nativeEnum(AnnouncementStatus).optional(),
  priority: z.nativeEnum(AnnouncementPriority).optional(),
  premiumNotification: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  publishedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
}).openapi("Announcement") satisfies z.ZodType<AnnouncementArgs>;

export const announcementTargetResponseSchema = z.object({
  id: z.string().uuid(),
  announcementId: z.string().uuid(),
  targetKind: z.nativeEnum(AnnouncementTargetKind),
  targetId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("AnnouncementTarget") satisfies z.ZodType<AnnouncementTargetArgs>;

export const messageDeliveryResponseSchema = z.object({
  id: z.string().uuid(),
  announcementId: z.string().uuid(),
  recipientKind: z.nativeEnum(MessageDeliveryRecipientKind),
  recipientId: z.string().uuid(),
  channel: z.nativeEnum(MessageDeliveryChannel),
  status: z.nativeEnum(MessageDeliveryStatus).optional(),
  providerMessageId: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  sentAt: z.coerce.date().nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).openapi("MessageDelivery") satisfies z.ZodType<MessageDeliveryArgs>;

export const subjectResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable().optional(),
  defaultCoefficient: z.number().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Subject") satisfies z.ZodType<SubjectArgs>;

export const subjectMatterResponseSchema = z.object({
  id: z.string().uuid(),
  subjectId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  sequenceOrder: z.number(),
  estimatedHours: z.number().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("SubjectMatter") satisfies z.ZodType<SubjectMatterArgs>;

export const classGroupResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  name: z.string(),
  capacity: z.number().int().positive().nullable().optional(),
  attendanceMode: z.nativeEnum(AttendanceMode).optional(),
  homeroomStaffId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("ClassGroup") satisfies z.ZodType<ClassGroupArgs>;

export const classSubjectResponseSchema = z.object({
  id: z.string().uuid(),
  classGroupId: z.string().uuid(),
  subjectId: z.string().uuid(),
  coefficient: z.number().nullable().optional(),
  completedPercentage: z.number().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("ClassSubject") satisfies z.ZodType<ClassSubjectArgs>;

export const classSubjectMatterResponseSchema = z.object({
  id: z.string().uuid(),
  classSubjectId: z.string().uuid(),
  subjectMatterId: z.string().uuid(),
  status: z.nativeEnum(ClassSubjectMatterStatus),
  completedPercentage: z.number(),
  updatedByStaffId: z.string().uuid().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  updatedAt: z.coerce.date().optional(),
}).openapi("ClassSubjectMatter") satisfies z.ZodType<ClassSubjectMatterArgs>;

export const classSubjectProgressResponseSchema = z.object({
  id: z.string().uuid(),
  classSubjectMatterId: z.string().uuid(),
  sessionId: z.string().uuid(),
  completedPercentage: z.number(),
  recordedByStaffId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  recordedAt: z.coerce.date().optional(),
}).openapi("ClassSubjectProgress") satisfies z.ZodType<ClassSubjectProgressArgs>;

export const assessmentResponseSchema = z.object({
  id: z.string().uuid(),
  classGroupId: z.string().uuid(),
  classSubjectId: z.string().uuid(),
  periodId: z.string().uuid(),
  title: z.string(),
  kind: z.nativeEnum(AssessmentKind),
  maxScore: z.number(),
  coefficient: z.number().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  metAt: z.coerce.date().nullable().optional(),
  date: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Assessment") satisfies z.ZodType<AssessmentArgs>;

export const assessmentResultResponseSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  score: z.number().nullable().optional(),
  status: z.nativeEnum(DeadlineComplianceStatus).nullable().optional(),
  notes: z.string().nullable().optional(),
  createdBy: z.string().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("AssessmentResult") satisfies z.ZodType<AssessmentResultArgs>;

export const gradeScaleRangeSchema = z.object({
  letter: z.string(),
  minScore: z.number(),
  maxScore: z.number(),
  gpaValue: z.number().nullable().optional(),
  interpretation: z.string().nullable().optional(),
  isPassing: z.boolean(),
}) satisfies z.ZodType<GradeScaleRange>;

export const gradeScaleResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  minScore: z.number(),
  maxScore: z.number(),
  ranges: z.array(gradeScaleRangeSchema),
  isDefault: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("GradeScale") satisfies z.ZodType<GradeScaleArgs>;

export const definitionResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  name: z.string(),
  kind: z.nativeEnum(ReportCardDefinitionKind).optional(),
  isDefault: z.boolean().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("ReportCardDefinition") satisfies z.ZodType<ReportCardDefinitionArgs>;

export const sectionResponseSchema = z.object({
  id: z.string().uuid(),
  reportCardDefinitionId: z.string().uuid(),
  name: z.string(),
  kind: z.nativeEnum(ReportCardDefinitionSectionKind).optional(),
  order: z.number().int().positive(),
  weight: z.number(),
  parentSectionId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("ReportCardDefinitionSection") satisfies z.ZodType<ReportCardDefinitionSectionArgs>;

export const reportCardResultSectionSchema: z.ZodType<ReportCardResultSection> = z.lazy(() => z.object({
  sectionId: z.string().uuid(),
  sectionKind: z.nativeEnum(ReportCardDefinitionSectionKind),
  name: z.string(),
  average: z.number(),
  weight: z.number(),
  parentSectionId: z.string().uuid().optional(),
  classSubjectId: z.string().uuid().optional(),
  subResults: z.array(reportCardResultSectionSchema).optional(),
}));

export const resultResponseSchema = z.object({
  id: z.string().uuid(),
  reportCardDefinitionId: z.string().uuid(),
  studentId: z.string().uuid(),
  classGroupId: z.string().uuid(),
  periodId: z.string().uuid(),
  sectionResults: z.array(reportCardResultSectionSchema),

  attendanceSummary: z.object({
    presentCount: z.number(),
    absenceCount: z.number(),
    excusedAbsenceCount: z.number(),
    lateCount: z.number(),
  }) satisfies z.ZodType<AttendanceSummary>,

  assessmentResultCount: z.number(),
  overallAverage: z.number().nullable().optional(),
  rank: z.number().nullable().optional(),
  classSize: z.number().nullable().optional(),
  passThreshold: z.number().nullable().optional(),
  teacherComment: z.string().nullable().optional(),
  principalComment: z.string().nullable().optional(),
  status: z.nativeEnum(ReportCardResultStatus).optional(),
  generatedAt: z.coerce.date().optional(),
  publishedAt: z.coerce.date().optional(),
}).openapi("ReportCardResult") satisfies z.ZodType<ReportCardResultArgs>;

export const studentResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.string().nullable().optional(),
  birthDate: z.coerce.date().optional(),
  placeOfBirth: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  matricule: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  enrollmentDate: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Student") satisfies z.ZodType<StudentArgs>;

export const enrollmentResponseSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  classGroupId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  enrollmentIndex: z.number().int().positive(),
  status: z.nativeEnum(StudentClassEnrollmentStatus).optional(),
  enrolledAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().nullable().optional(),
  endReason: z.nativeEnum(EnrollmentEndReason).nullable().optional(),
  progressionDecision: z.nativeEnum(ProgressionDecision).nullable().optional(),
  previousEnrollmentId: z.string().uuid().nullable().optional(),
  closedBy: z.string().nullable().optional(),
  progressionDecidedAt: z.coerce.date().nullable().optional(),
  progressionDecidedBy: z.string().nullable().optional(),
  progressionNotes: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("StudentClassEnrollment") satisfies z.ZodType<StudentClassEnrollmentArgs>;

export const guardianResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  hasAccess: z.boolean().optional(),
  premiumNotificationsEnabled: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("Guardian") satisfies z.ZodType<GuardianArgs>;

export const guardianLinkResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  guardianId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isBillingContact: z.boolean().optional(),
  legalGuardian: z.boolean().optional(),
  canPickup: z.boolean().optional(),
  emergencyContactPriority: z.number().int().positive().nullable().optional(),
  receivesAcademicReports: z.boolean().optional(),
  receivesAttendanceAlerts: z.boolean().optional(),
  contactRestrictions: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("GuardianStudentLink") satisfies z.ZodType<GuardianStudentLinkArgs>;

export const studentNoteResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  authorStaffId: z.string().uuid(),
  body: z.string(),
  title: z.string().nullable().optional(),
  visibility: z.nativeEnum(StudentNoteVisibility).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).openapi("StudentNote") satisfies z.ZodType<StudentNoteArgs>;

export const studentHealthProfileResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  allergies: z.string().nullable().optional(),
  medicalConditions: z.string().nullable().optional(),
  emergencyProtocols: z.string().nullable().optional(),
  bloodType: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).openapi("StudentHealthProfile") satisfies z.ZodType<StudentHealthProfileArgs>;

export const studentDisciplinaryActionResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  incidentId: z.string().uuid(),
  studentId: z.string().uuid(),
  disciplinaryActionId: z.string().uuid(),
  assignedByStaffId: z.string().uuid(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(StudentDisciplinaryActionStatus).optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).openapi("StudentDisciplinaryAction") satisfies z.ZodType<StudentDisciplinaryActionArgs>;

export const disciplinaryActionResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  kind: z.nativeEnum(DisciplinaryActionKind),
  severity: z.number().nullable().optional(),
  defaultDurationDays: z.number().int().positive().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("DisciplinaryAction") satisfies z.ZodType<DisciplinaryActionArgs>;

export const studentIncidentInvolvementResponseSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  studentId: z.string().uuid(),
  role: z.nativeEnum(IncidentInvolvementRole),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
}).openapi("StudentIncidentInvolvement") satisfies z.ZodType<StudentIncidentInvolvementArgs>;

export const incidentResponseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  kind: z.nativeEnum(IncidentKind),
  reporterId: z.string().uuid(),
  classGroupId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(IncidentStatus).optional(),
  resolutionNotes: z.string().nullable().optional(),
  resolvedAt: z.coerce.date().nullable().optional(),
  resolvedByStaffId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).openapi("Incident") satisfies z.ZodType<IncidentArgs>;

// ==========================================================
// 2. All 42 Query Filter (QueryOptions) OpenAPI Schemas
// ==========================================================

export const schoolQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  name: z.string(),
});

export const academicYearQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
});

export const academicPeriodQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string(),
});

export const periodDefinitionQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
});

export const gradeLevelQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
});

export const staffMemberQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  isActive: z.boolean(),
});

export const staffAssignmentQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  staffMemberId: z.string().uuid(),
  classGroupId: z.string().uuid(),
  role: z.string(),
});

export const attachmentQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  mimeType: z.string(),
});

export const resourceQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  type: z.string(),
});

export const resourceAssignmentQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  resourceId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const feeQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
});

export const studentFeeQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  feeId: z.string().uuid(),
  status: z.string(),
});

export const paymentQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentFeeId: z.string().uuid(),
  paymentMethod: z.string(),
});

export const scheduleQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  classGroupId: z.string().uuid(),
  name: z.string(),
});

export const sessionQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  classGroupId: z.string().uuid(),
  classSubjectId: z.string().uuid(),
  periodDefinitionId: z.string().uuid(),
});

export const calendarEventQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  title: z.string(),
});

export const attendanceQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  status: z.string(),
});

export const announcementQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  title: z.string(),
  status: z.string(),
});

export const announcementTargetQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  announcementId: z.string().uuid(),
  targetType: z.string(),
  targetId: z.string().uuid(),
});

export const messageDeliveryQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  messageId: z.string().uuid(),
  recipientId: z.string().uuid(),
  status: z.string(),
});

export const subjectQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  code: z.string(),
});

export const subjectMatterQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  subjectId: z.string().uuid(),
  name: z.string(),
});

export const classGroupQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string(),
});

export const classSubjectQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  classGroupId: z.string().uuid(),
  subjectId: z.string().uuid(),
});

export const classSubjectMatterQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  classSubjectId: z.string().uuid(),
  subjectMatterId: z.string().uuid(),
  status: z.string(),
});

export const classSubjectProgressQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  classSubjectMatterId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const assessmentQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  classSubjectId: z.string().uuid(),
  name: z.string(),
});

export const assessmentResultQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  grade: z.string(),
});

export const gradeScaleQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
  grade: z.string(),
});

export const definitionQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string(),
});

export const sectionQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  reportCardDefinitionId: z.string().uuid(),
  name: z.string(),
});

export const resultQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  reportCardDefinitionId: z.string().uuid(),
  grade: z.string(),
});

export const studentQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  status: z.string(),
  matricule: z.string(),
});

export const enrollmentQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  classGroupId: z.string().uuid(),
});

export const guardianQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
});

export const guardianLinkQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  guardianId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.string(),
});

export const studentNoteQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  title: z.string(),
});

export const studentHealthProfileQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export const studentDisciplinaryActionQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  disciplinaryActionId: z.string().uuid(),
});

export const disciplinaryActionQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string(),
});

export const studentIncidentInvolvementQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  incidentId: z.string().uuid(),
  role: z.string(),
});

export const incidentQuerySchema = createQueryOptionsSchema({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  title: z.string(),
});
