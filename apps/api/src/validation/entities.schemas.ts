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
  Permission,
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
  AccessRoleArgs,
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
  StaffRoleAssignmentArgs,
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
import { createQueryOptionsSchema } from "./utils/query-options";
import { field, responseSchema, valueSchema } from "./utils/schema-fields";

const scopeTypeSchema = z.enum([
  "platform",
  "school",
  "academic_year",
  "class_group",
  "subject",
  "course_assignment",
  "session",
  "student",
  "student_group",
]);

// ==========================================================
// 1. All 42 Domain Entities Response OpenAPI Schemas
// ==========================================================

export const schoolResponseSchema = responseSchema<SchoolArgs>("School", {
  id: field.uuid(),
  name: field.string(),
  timeZone: field.string(),
  createdAt: field.date(),
});

export const academicYearResponseSchema = responseSchema<AcademicYearArgs>("AcademicYear", {
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  startDate: field.date(),
  endDate: field.date(),
  createdAt: field.date(),
});

export const academicPeriodResponseSchema = responseSchema<AcademicPeriodArgs>("AcademicPeriod", {
  id: field.uuid(),
  schoolId: field.uuid(),
  academicYearId: field.uuid(),
  name: field.string(),
  type: z.nativeEnum(AcademicPeriodType),
  startDate: field.date(),
  endDate: field.date(),
  isPublished: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const periodDefinitionResponseSchema = responseSchema<PeriodDefinitionArgs>("PeriodDefinition", {
  id: field.uuid(),
  schoolId: field.uuid(),
  academicYearId: field.uuid(),
  label: field.string(),
  order: field.positiveInt(),
  startTime: field.string(),
  endTime: field.string(),
  isBreak: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const gradeLevelResponseSchema = responseSchema<GradeLevelArgs>("GradeLevel", {
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  order: field.positiveInt(),
  cycle: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const staffMemberResponseSchema = responseSchema<StaffMemberArgs>("StaffMember", {
  id: field.uuid(),
  schoolId: field.uuid(),
  firstName: field.string(),
  lastName: field.string(),
  email: field.nullableEmail(),
  subjectId: field.nullableUuid(),
  isActive: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const staffAssignmentResponseSchema = responseSchema<StaffAssignmentArgs>("StaffAssignment", {
  id: field.uuid(),
  staffId: field.uuid(),
  role: z.nativeEnum(StaffRole),
  classGroupId: field.nullableUuid(),
  classSubjectId: field.nullableUuid(),
  sessionId: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const scopeGrantResponseSchema = valueSchema({
  permission: z.nativeEnum(Permission),
  scopeType: scopeTypeSchema,
  scopeEntityIds: z.array(field.string()),
});

export const accessRoleResponseSchema = responseSchema<AccessRoleArgs>("AccessRole", {
  id: field.string(),
  schoolId: field.string(),
  name: field.string(),
  description: field.nullableText(),
  isSystemRole: field.boolean(),
  systemRoleKey: z.nativeEnum(StaffRole).nullable().optional(),
  permissions: z.array(z.nativeEnum(Permission)),
  status: z.enum(["active", "inactive"]),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const staffRoleAssignmentResponseSchema = responseSchema<StaffRoleAssignmentArgs>("StaffRoleAssignment", {
  id: field.string(),
  staffId: field.string(),
  schoolId: field.string(),
  academicYearId: field.nullableText(),
  roleIds: z.array(field.string()),
  scopeGrants: z.array(scopeGrantResponseSchema).optional(),
  status: z.enum(["active", "inactive", "expired"]).optional(),
  startsAt: field.nullableDate(),
  endsAt: field.nullableDate(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const attachmentResponseSchema = responseSchema<AttachmentArgs>("Attachment", {
  id: field.uuid(),
  schoolId: field.uuid(),
  ownerKind: z.nativeEnum(AttachmentOwnerKind),
  ownerId: field.uuid(),
  fileName: field.string(),
  fileUrl: field.string(),
  mimeType: field.nullableText(),
  sizeBytes: field.nullableNonNegativeInt(),
  uploadedById: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const resourceResponseSchema = responseSchema<ResourceArgs>("Resource", {
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  description: field.nullableText(),
  kind: z.nativeEnum(ResourceKind),
  capacity: field.nullableNonNegativeInt(),
  createdAt: field.optionalDate(),
});

export const resourceAssignmentResponseSchema = responseSchema<ResourceAssignmentArgs>("ResourceAssignment", {
  id: field.uuid(),
  resourceId: field.uuid(),
  sessionId: field.nullableUuid(),
  classGroupId: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const feeInstallmentTemplateSchema = valueSchema<FeeInstallmentTemplate>({
  label: field.string(),
  percentage: field.number(),
  dueDate: field.nullableDate(),
});

export const feeResponseSchema = responseSchema<FeeArgs>("Fee", {
  id: field.uuid(),
  schoolId: field.uuid(),
  academicYearId: field.uuid(),
  name: field.string(),
  category: z.nativeEnum(FeeCategory).optional(),
  description: field.nullableText(),
  defaultAmount: field.number(),
  currency: field.string(),
  installments: z.array(feeInstallmentTemplateSchema).optional(),
  createdAt: field.optionalDate(),
});

export const studentFeeInstallmentSchema = valueSchema<StudentFeeInstallment>({
  id: field.uuid(),
  label: field.string(),
  expectedAmount: field.number(),
  dueDate: field.nullableDate(),
});

export const studentFeeResponseSchema = responseSchema<StudentFeeArgs>("StudentFee", {
  id: field.uuid(),
  studentId: field.uuid(),
  feeId: field.uuid(),
  academicYearId: field.uuid(),
  expectedAmount: field.number(),
  paidAmount: field.nullableNumber(),
  adjustmentAmount: field.nullableNumber(),
  adjustmentReason: field.nullableText(),
  adjustedById: field.nullableUuid(),
  adjustedAt: field.nullableDate(),
  currency: field.string(),
  dueDate: field.nullableDate(),
  status: z.nativeEnum(FeeStatus),
  cancellationReason: field.nullableText(),
  cancelledById: field.nullableUuid(),
  cancelledAt: field.nullableDate(),
  installments: z.array(studentFeeInstallmentSchema).optional(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const paymentResponseSchema = responseSchema<PaymentArgs>("Payment", {
  id: field.uuid(),
  studentFeeId: field.uuid(),
  amount: field.number(),
  currency: field.string(),
  paymentDate: field.date(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus).optional(),
  reference: field.nullableText(),
  notes: field.nullableText(),
  recordedById: field.nullableUuid(),
  reversedAt: field.nullableDate(),
  reversedById: field.nullableUuid(),
  cancelledAt: field.nullableDate(),
  cancelledById: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const scheduleResponseSchema = responseSchema<ScheduleArgs>("Schedule", {
  id: field.uuid(),
  classGroupId: field.uuid(),
  classSubjectId: field.nullableUuid(),
  title: field.string(),
  isRecurring: field.boolean(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  startTime: field.string(),
  endTime: field.string(),
  specificDate: field.nullableDate(),
  createdAt: field.optionalDate(),
});

export const sessionResponseSchema = responseSchema<SessionArgs>("Session", {
  id: field.uuid(),
  classGroupId: field.uuid(),
  title: field.string(),
  kind: z.nativeEnum(SessionKind),
  startsAt: field.date(),
  endsAt: field.date(),
  classSubjectId: field.nullableUuid(),
  scheduleId: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const calendarEventResponseSchema = responseSchema<CalendarEventArgs>("CalendarEvent", {
  id: field.uuid(),
  schoolId: field.uuid(),
  academicYearId: field.uuid(),
  title: field.string(),
  startDate: field.date(),
  endDate: field.date(),
  kind: z.nativeEnum(CalendarEventKind),
  isNonSchoolDay: field.optionalBoolean(),
  scopeKind: z.nativeEnum(CalendarEventScopeKind).optional(),
  scopeId: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const attendanceResponseSchema = responseSchema<AttendanceRecordArgs>("Attendance", {
  id: field.uuid(),
  studentId: field.uuid(),
  sessionId: field.uuid(),
  date: field.date(),
  status: z.nativeEnum(AttendanceStatus),
  justificationStatus: z.nativeEnum(AttendanceJustificationStatus).optional(),
  reason: field.nullableText(),
  notes: field.nullableText(),
  justifiedAt: field.nullableDate(),
  justifiedByStaffId: field.nullableUuid(),
  correctedAt: field.nullableDate(),
  correctedByStaffId: field.nullableUuid(),
  createdBy: field.optionalString(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const announcementResponseSchema = responseSchema<AnnouncementArgs>("Announcement", {
  id: field.uuid(),
  schoolId: field.uuid(),
  title: field.string(),
  content: field.string(),
  createdBy: field.optionalString(),
  status: z.nativeEnum(AnnouncementStatus).optional(),
  priority: z.nativeEnum(AnnouncementPriority).optional(),
  premiumNotification: field.optionalBoolean(),
  createdAt: field.optionalDate(),
  publishedAt: field.optionalDate(),
  expiresAt: field.nullableDate(),
});

export const announcementTargetResponseSchema = responseSchema<AnnouncementTargetArgs>("AnnouncementTarget", {
  id: field.uuid(),
  announcementId: field.uuid(),
  targetKind: z.nativeEnum(AnnouncementTargetKind),
  targetId: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const messageDeliveryResponseSchema = responseSchema<MessageDeliveryArgs>("MessageDelivery", {
  id: field.uuid(),
  announcementId: field.uuid(),
  recipientKind: z.nativeEnum(MessageDeliveryRecipientKind),
  recipientId: field.uuid(),
  channel: z.nativeEnum(MessageDeliveryChannel),
  status: z.nativeEnum(MessageDeliveryStatus).optional(),
  providerMessageId: field.nullableText(),
  failureReason: field.nullableText(),
  sentAt: field.nullableDate(),
  readAt: field.nullableDate(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const subjectResponseSchema = responseSchema<SubjectArgs>("Subject", {
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  code: field.nullableText(),
  defaultCoefficient: field.nullableNumber(),
  createdAt: field.optionalDate(),
});

export const subjectMatterResponseSchema = responseSchema<SubjectMatterArgs>("SubjectMatter", {
  id: field.uuid(),
  subjectId: field.uuid(),
  name: field.string(),
  description: field.nullableText(),
  sequenceOrder: field.number(),
  estimatedHours: field.nullableNumber(),
  createdAt: field.optionalDate(),
});

export const classGroupResponseSchema = responseSchema<ClassGroupArgs>("ClassGroup", {
  id: field.uuid(),
  schoolId: field.uuid(),
  academicYearId: field.uuid(),
  gradeLevelId: field.uuid(),
  name: field.string(),
  capacity: field.nullablePositiveInt(),
  attendanceMode: z.nativeEnum(AttendanceMode).optional(),
  homeroomStaffId: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const classSubjectResponseSchema = responseSchema<ClassSubjectArgs>("ClassSubject", {
  id: field.uuid(),
  classGroupId: field.uuid(),
  subjectId: field.uuid(),
  coefficient: field.nullableNumber(),
  completedPercentage: field.nullableNumber(),
  createdAt: field.optionalDate(),
});

export const classSubjectMatterResponseSchema = responseSchema<ClassSubjectMatterArgs>("ClassSubjectMatter", {
  id: field.uuid(),
  classSubjectId: field.uuid(),
  subjectMatterId: field.uuid(),
  status: z.nativeEnum(ClassSubjectMatterStatus),
  completedPercentage: field.number(),
  updatedByStaffId: field.nullableUuid(),
  startedAt: field.nullableDate(),
  completedAt: field.nullableDate(),
  notes: field.nullableText(),
  updatedAt: field.optionalDate(),
});

export const classSubjectProgressResponseSchema = responseSchema<ClassSubjectProgressArgs>("ClassSubjectProgress", {
  id: field.uuid(),
  classSubjectMatterId: field.uuid(),
  sessionId: field.uuid(),
  completedPercentage: field.number(),
  recordedByStaffId: field.nullableUuid(),
  notes: field.nullableText(),
  recordedAt: field.optionalDate(),
});

export const assessmentResponseSchema = responseSchema<AssessmentArgs>("Assessment", {
  id: field.uuid(),
  classGroupId: field.uuid(),
  classSubjectId: field.uuid(),
  periodId: field.uuid(),
  title: field.string(),
  kind: z.nativeEnum(AssessmentKind),
  maxScore: field.number(),
  coefficient: field.optionalNumber(),
  sessionId: field.nullableUuid(),
  dueAt: field.nullableDate(),
  metAt: field.nullableDate(),
  date: field.nullableDate(),
  createdAt: field.optionalDate(),
});

export const assessmentResultResponseSchema = responseSchema<AssessmentResultArgs>("AssessmentResult", {
  id: field.uuid(),
  studentId: field.uuid(),
  assessmentId: field.uuid(),
  score: field.nullableNumber(),
  status: z.nativeEnum(DeadlineComplianceStatus).nullable().optional(),
  notes: field.nullableText(),
  createdBy: field.optionalString(),
  createdAt: field.optionalDate(),
});

export const gradeScaleRangeSchema = valueSchema<GradeScaleRange>({
  letter: field.string(),
  minScore: field.number(),
  maxScore: field.number(),
  gpaValue: field.nullableNumber(),
  interpretation: field.nullableText(),
  isPassing: field.boolean(),
});

export const gradeScaleResponseSchema = responseSchema<GradeScaleArgs>("GradeScale", {
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  minScore: field.number(),
  maxScore: field.number(),
  ranges: z.array(gradeScaleRangeSchema),
  isDefault: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const definitionResponseSchema = responseSchema<ReportCardDefinitionArgs>("ReportCardDefinition", {
  id: field.uuid(),
  schoolId: field.uuid(),
  academicYearId: field.uuid(),
  gradeLevelId: field.uuid(),
  name: field.string(),
  kind: z.nativeEnum(ReportCardDefinitionKind).optional(),
  isDefault: field.optionalBoolean(),
  description: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const sectionResponseSchema = responseSchema<ReportCardDefinitionSectionArgs>("ReportCardDefinitionSection", {
  id: field.uuid(),
  reportCardDefinitionId: field.uuid(),
  name: field.string(),
  kind: z.nativeEnum(ReportCardDefinitionSectionKind).optional(),
  order: field.positiveInt(),
  weight: field.number(),
  parentSectionId: field.nullableUuid(),
  subjectId: field.nullableUuid(),
  createdAt: field.optionalDate(),
});

export const reportCardResultSectionSchema: z.ZodType<ReportCardResultSection> = z.lazy(() => z.object({
  sectionId: field.uuid(),
  sectionKind: z.nativeEnum(ReportCardDefinitionSectionKind),
  name: field.string(),
  average: field.number(),
  weight: field.number(),
  parentSectionId: field.optionalUuid(),
  classSubjectId: field.optionalUuid(),
  subResults: z.array(reportCardResultSectionSchema),
}));

export const resultResponseSchema = responseSchema<ReportCardResultArgs>("ReportCardResult", {
  id: field.uuid(),
  reportCardDefinitionId: field.uuid(),
  studentId: field.uuid(),
  classGroupId: field.uuid(),
  periodId: field.uuid(),
  sectionResults: z.array(reportCardResultSectionSchema),

  attendanceSummary: valueSchema<AttendanceSummary>({
    presentCount: field.number(),
    absenceCount: field.number(),
    excusedAbsenceCount: field.number(),
    lateCount: field.number(),
    total: field.number(),
    attendanceRate: field.number(),
  }),

  assessmentResultCount: field.number(),
  overallAverage: field.nullableNumber(),
  rank: field.nullableNumber(),
  classSize: field.nullableNumber(),
  passThreshold: field.nullableNumber(),
  teacherComment: field.nullableText(),
  principalComment: field.nullableText(),
  status: z.nativeEnum(ReportCardResultStatus).optional(),
  generatedAt: field.optionalDate(),
  publishedAt: field.optionalDate(),
});

export const studentResponseSchema = responseSchema<StudentArgs>("Student", {
  id: field.uuid(),
  schoolId: field.uuid(),
  firstName: field.string(),
  lastName: field.string(),
  gender: field.nullableText(),
  birthDate: field.optionalDate(),
  placeOfBirth: field.nullableText(),
  nationality: field.nullableText(),
  matricule: field.nullableText(),
  photoUrl: field.nullableText(),
  subjectId: field.nullableUuid(),
  status: z.nativeEnum(StudentStatus).optional(),
  enrollmentDate: field.nullableDate(),
  createdAt: field.optionalDate(),
});

export const enrollmentResponseSchema = responseSchema<StudentClassEnrollmentArgs>("StudentClassEnrollment", {
  id: field.uuid(),
  studentId: field.uuid(),
  classGroupId: field.uuid(),
  academicYearId: field.uuid(),
  enrollmentIndex: field.positiveInt(),
  status: z.nativeEnum(StudentClassEnrollmentStatus).optional(),
  enrolledAt: field.optionalDate(),
  endedAt: field.nullableDate(),
  endReason: z.nativeEnum(EnrollmentEndReason).nullable().optional(),
  progressionDecision: z.nativeEnum(ProgressionDecision).nullable().optional(),
  previousEnrollmentId: field.nullableUuid(),
  closedBy: field.nullableText(),
  progressionDecidedAt: field.nullableDate(),
  progressionDecidedBy: field.nullableText(),
  progressionNotes: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const guardianResponseSchema = responseSchema<GuardianArgs>("Guardian", {
  id: field.uuid(),
  schoolId: field.uuid(),
  firstName: field.string(),
  lastName: field.string(),
  phone: field.nullableText(),
  email: field.nullableEmail(),
  subjectId: field.nullableUuid(),
  hasAccess: field.optionalBoolean(),
  premiumNotificationsEnabled: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const guardianLinkResponseSchema = responseSchema<GuardianStudentLinkArgs>("GuardianStudentLink", {
  id: field.uuid(),
  schoolId: field.uuid(),
  guardianId: field.uuid(),
  studentId: field.uuid(),
  relationship: field.optionalString(),
  isPrimary: field.optionalBoolean(),
  isBillingContact: field.optionalBoolean(),
  legalGuardian: field.optionalBoolean(),
  canPickup: field.optionalBoolean(),
  emergencyContactPriority: field.nullablePositiveInt(),
  receivesAcademicReports: field.optionalBoolean(),
  receivesAttendanceAlerts: field.optionalBoolean(),
  contactRestrictions: field.nullableText(),
  notes: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const studentNoteResponseSchema = responseSchema<StudentNoteArgs>("StudentNote", {
  id: field.uuid(),
  schoolId: field.uuid(),
  studentId: field.uuid(),
  authorStaffId: field.uuid(),
  body: field.string(),
  title: field.nullableText(),
  visibility: z.nativeEnum(StudentNoteVisibility).optional(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const studentHealthProfileResponseSchema = responseSchema<StudentHealthProfileArgs>("StudentHealthProfile", {
  id: field.uuid(),
  schoolId: field.uuid(),
  studentId: field.uuid(),
  allergies: field.nullableText(),
  medicalConditions: field.nullableText(),
  emergencyProtocols: field.nullableText(),
  bloodType: field.nullableText(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const studentDisciplinaryActionResponseSchema = responseSchema<StudentDisciplinaryActionArgs>("StudentDisciplinaryAction", {
  id: field.uuid(),
  schoolId: field.uuid(),
  incidentId: field.uuid(),
  studentId: field.uuid(),
  disciplinaryActionId: field.uuid(),
  assignedByStaffId: field.uuid(),
  startsAt: field.nullableDate(),
  endsAt: field.nullableDate(),
  status: z.nativeEnum(StudentDisciplinaryActionStatus).optional(),
  notes: field.nullableText(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const disciplinaryActionResponseSchema = responseSchema<DisciplinaryActionArgs>("DisciplinaryAction", {
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  kind: z.nativeEnum(DisciplinaryActionKind),
  severity: field.nullableNumber(),
  defaultDurationDays: field.nullablePositiveInt(),
  description: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const studentIncidentInvolvementResponseSchema = responseSchema<StudentIncidentInvolvementArgs>("StudentIncidentInvolvement", {
  id: field.uuid(),
  incidentId: field.uuid(),
  studentId: field.uuid(),
  role: z.nativeEnum(IncidentInvolvementRole),
  notes: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const incidentResponseSchema = responseSchema<IncidentArgs>("Incident", {
  id: field.uuid(),
  schoolId: field.uuid(),
  title: field.string(),
  description: field.string(),
  date: field.date(),
  kind: z.nativeEnum(IncidentKind),
  reporterId: field.uuid(),
  classGroupId: field.nullableUuid(),
  sessionId: field.nullableUuid(),
  status: z.nativeEnum(IncidentStatus).optional(),
  resolutionNotes: field.nullableText(),
  resolvedAt: field.nullableDate(),
  resolvedByStaffId: field.nullableUuid(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

// ==========================================================
// 2. All 42 Query Filter (QueryOptions) OpenAPI Schemas
// ==========================================================

export const schoolQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  name: field.string(),
});

export const academicYearQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
});

export const academicPeriodQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  academicYearId: field.uuid(),
  name: field.string(),
});

export const periodDefinitionQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
});

export const gradeLevelQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
});

export const staffMemberQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  firstName: field.string(),
  lastName: field.string(),
  isActive: field.boolean(),
});

export const staffAssignmentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  staffId: field.uuid(),
  classGroupId: field.uuid(),
  classSubjectId: field.uuid(),
  sessionId: field.uuid(),
  role: field.string(),
});

export const accessRoleQuerySchema = createQueryOptionsSchema({
  id: field.string(),
  schoolId: field.string(),
  name: field.string(),
  isSystemRole: field.boolean(),
  systemRoleKey: field.string(),
  status: field.string(),
});

export const staffRoleAssignmentQuerySchema = createQueryOptionsSchema({
  id: field.string(),
  staffId: field.string(),
  schoolId: field.string(),
  academicYearId: field.string(),
  status: field.string(),
});

export const attachmentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  fileName: field.string(),
  mimeType: field.string(),
});

export const resourceQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  kind: field.string(),
});

export const resourceAssignmentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  resourceId: field.uuid(),
  sessionId: field.uuid(),
  classGroupId: field.uuid(),
});

export const feeQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
});

export const studentFeeQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  studentId: field.uuid(),
  feeId: field.uuid(),
  status: field.string(),
});

export const paymentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  studentFeeId: field.uuid(),
  method: field.string(),
  status: field.string(),
});

export const scheduleQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  classGroupId: field.uuid(),
  classSubjectId: field.uuid(),
  title: field.string(),
});

export const sessionQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  scheduleId: field.uuid(),
  classGroupId: field.uuid(),
  classSubjectId: field.uuid(),
  title: field.string(),
  kind: field.string(),
});

export const calendarEventQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  title: field.string(),
});

export const attendanceQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  studentId: field.uuid(),
  sessionId: field.uuid(),
  status: field.string(),
});

export const announcementQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  title: field.string(),
  status: field.string(),
});

export const announcementTargetQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  announcementId: field.uuid(),
  targetKind: field.string(),
  targetId: field.uuid(),
});

export const messageDeliveryQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  announcementId: field.uuid(),
  recipientKind: field.string(),
  recipientId: field.uuid(),
  channel: field.string(),
  status: field.string(),
});

export const subjectQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  code: field.string(),
});

export const subjectMatterQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  subjectId: field.uuid(),
  name: field.string(),
});

export const classGroupQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  gradeLevelId: field.uuid(),
  academicYearId: field.uuid(),
  name: field.string(),
});

export const classSubjectQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  classGroupId: field.uuid(),
  subjectId: field.uuid(),
});

export const classSubjectMatterQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  classSubjectId: field.uuid(),
  subjectMatterId: field.uuid(),
  status: field.string(),
});

export const classSubjectProgressQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  classSubjectMatterId: field.uuid(),
  sessionId: field.uuid(),
});

export const assessmentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  classSubjectId: field.uuid(),
  classGroupId: field.uuid(),
  periodId: field.uuid(),
  title: field.string(),
  kind: field.string(),
});

export const assessmentResultQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  assessmentId: field.uuid(),
  studentId: field.uuid(),
  status: field.string(),
});

export const gradeScaleQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
  isDefault: field.boolean(),
});

export const definitionQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  academicYearId: field.uuid(),
  name: field.string(),
});

export const sectionQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  reportCardDefinitionId: field.uuid(),
  name: field.string(),
});

export const resultQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  studentId: field.uuid(),
  reportCardDefinitionId: field.uuid(),
  classGroupId: field.uuid(),
  periodId: field.uuid(),
  status: field.string(),
});

export const studentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  firstName: field.string(),
  lastName: field.string(),
  status: field.string(),
  matricule: field.string(),
});

export const enrollmentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  studentId: field.uuid(),
  classGroupId: field.uuid(),
  academicYearId: field.uuid(),
  status: field.string(),
});

export const guardianQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  firstName: field.string(),
  lastName: field.string(),
  email: field.string(),
});

export const guardianLinkQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  guardianId: field.uuid(),
  studentId: field.uuid(),
  relationship: field.string(),
});

export const studentNoteQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  studentId: field.uuid(),
  title: field.string(),
});

export const studentHealthProfileQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  studentId: field.uuid(),
});

export const studentDisciplinaryActionQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  studentId: field.uuid(),
  disciplinaryActionId: field.uuid(),
});

export const disciplinaryActionQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  name: field.string(),
});

export const studentIncidentInvolvementQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  studentId: field.uuid(),
  incidentId: field.uuid(),
  role: field.string(),
});

export const incidentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  title: field.string(),
});
