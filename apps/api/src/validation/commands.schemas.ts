import { z } from "@hono/zod-openapi";
import {
  AcademicPeriodType,
  AnnouncementPriority,
  AnnouncementTargetKind,
  AssessmentKind,
  AttachmentOwnerKind,
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  DayOfWeek,
  DeadlineComplianceStatus,
  DisciplinaryActionKind,
  EnrollmentEndReason,
  FeeCategory,
  GuardianContactMethodType,
  IncidentInvolvementRole,
  IncidentKind,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
  PaymentMethod,
  ProgressionDecision,
  ReportCardDefinitionKind,
  ReportCardDefinitionSectionKind,
  ResourceKind,
  SchoolType,
  SessionKind,
  StaffRole,
  StudentDisciplinaryActionStatus,
  StudentNoteVisibility,
  StudentStatus,
} from "@edaya/core";
import { field, namedObjectSchema } from "./utils/schema-fields";

const nullableId = () => field.id().nullable().optional();
const optionalText = () => z.string().optional();
const nullableOptionalText = () => z.string().nullable().optional();
const attendanceByStudentSchema = z.record(field.id(), field.enumValue(AttendanceStatus));

export const gradeLevelConfigCommandSchema = namedObjectSchema("GradeLevelConfigCommand", {
  id: field.id(),
  name: field.text(),
  order: field.positiveInt(),
  cycle: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const periodDefinitionConfigCommandSchema = namedObjectSchema("PeriodDefinitionConfigCommand", {
  id: field.id(),
  academicYearId: field.id(),
  label: field.text(),
  order: field.positiveInt(),
  startTime: field.timeOfDay(),
  endTime: field.timeOfDay(),
  isBreak: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const resourceConfigCommandSchema = namedObjectSchema("ResourceConfigCommand", {
  id: field.id(),
  name: field.text(),
  description: field.nullableText(),
  kind: field.enumValue(ResourceKind),
  capacity: field.nullablePositiveInt(),
  createdAt: field.optionalDate(),
});

export const subjectConfigCommandSchema = namedObjectSchema("SubjectConfigCommand", {
  id: field.id(),
  name: field.text(),
  code: field.nullableText(),
  defaultCoefficient: field.nullablePositiveNumber(),
  createdAt: field.optionalDate(),
});

export const subjectMatterConfigCommandSchema = namedObjectSchema("SubjectMatterConfigCommand", {
  id: field.id(),
  subjectId: field.id(),
  name: field.text(),
  description: field.nullableText(),
  sequenceOrder: field.positiveNumber(),
  estimatedHours: field.nullablePositiveNumber(),
  createdAt: field.optionalDate(),
});

export const disciplinaryActionConfigCommandSchema = namedObjectSchema("DisciplinaryActionConfigCommand", {
  id: field.id(),
  name: field.text(),
  kind: field.enumValue(DisciplinaryActionKind),
  severity: field.nullablePositiveNumber(),
  defaultDurationDays: field.nullablePositiveInt(),
  description: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const registerSchoolCommandSchema = namedObjectSchema("RegisterSchoolCommand", {
  id: field.id(),
  name: field.text(),
  timeZone: field.text(),
  type: field.enumValue(SchoolType).nullable().optional(),
  country: nullableOptionalText(),
  city: nullableOptionalText(),
  createdAt: field.optionalDate(),
});

export const updateSchoolConfigurationCommandSchema = namedObjectSchema("UpdateSchoolConfigurationCommand", {
  schoolId: field.id(),
  name: optionalText(),
  timeZone: optionalText(),
  type: field.enumValue(SchoolType).nullable().optional(),
  country: nullableOptionalText(),
  city: nullableOptionalText(),
});

export const createAcademicYearCommandSchema = namedObjectSchema("CreateAcademicYearCommand", {
  id: field.id(),
  schoolId: field.id(),
  name: field.text(),
  startDate: field.date(),
  endDate: field.date(),
  isActive: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const activateAcademicYearCommandSchema = namedObjectSchema("ActivateAcademicYearCommand", {
  academicYearId: field.id(),
});

export const publishAcademicPeriodCommandSchema = namedObjectSchema("PublishAcademicPeriodCommand", {
  academicPeriodId: field.id(),
});

export const createAcademicPeriodCommandSchema = namedObjectSchema("CreateAcademicPeriodCommand", {
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  name: field.text(),
  type: field.enumValue(AcademicPeriodType),
  startDate: field.date(),
  endDate: field.date(),
  isPublished: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const createClassGroupCommandSchema = namedObjectSchema("CreateClassGroupCommand", {
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  gradeLevelId: field.id(),
  name: field.text(),
  capacity: field.nullablePositiveInt(),
  attendanceMode: field.enumValue(AttendanceMode).optional(),
  homeroomStaffId: nullableId(),
  createdAt: field.optionalDate(),
});

export const updateClassGroupConfigurationCommandSchema = namedObjectSchema("UpdateClassGroupConfigurationCommand", {
  classGroupId: field.id(),
  name: optionalText(),
  capacity: field.nullablePositiveInt(),
  attendanceMode: field.enumValue(AttendanceMode).optional(),
  homeroomStaffId: nullableId(),
});

export const registerStaffMemberCommandSchema = namedObjectSchema("RegisterStaffMemberCommand", {
  id: field.id(),
  schoolId: field.id(),
  firstName: field.text(),
  lastName: field.text(),
  roles: z.array(field.enumValue(StaffRole)).min(1),
  email: z.string().email().optional(),
  isActive: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const updateStaffMemberStatusCommandSchema = namedObjectSchema("UpdateStaffMemberStatusCommand", {
  staffId: field.id(),
  isActive: field.boolean(),
});

export const assignStaffToClassCommandSchema = namedObjectSchema("AssignStaffToClassCommand", {
  id: field.id(),
  staffId: field.id(),
  classGroupId: field.id(),
  role: field.enumValue(StaffRole),
  createdAt: field.optionalDate(),
});

export const assignStaffToClassSubjectCommandSchema = namedObjectSchema("AssignStaffToClassSubjectCommand", {
  id: field.id(),
  staffId: field.id(),
  classSubjectId: field.id(),
  role: field.enumValue(StaffRole),
  createdAt: field.optionalDate(),
});

export const assignStaffToSessionCommandSchema = namedObjectSchema("AssignStaffToSessionCommand", {
  id: field.id(),
  staffId: field.id(),
  sessionId: field.id(),
  role: field.enumValue(StaffRole),
  createdAt: field.optionalDate(),
});

export const assignResourceToClassCommandSchema = namedObjectSchema("AssignResourceToClassCommand", {
  id: field.id(),
  resourceId: field.id(),
  classGroupId: field.id(),
  createdAt: field.optionalDate(),
});

export const assignResourceToSessionCommandSchema = namedObjectSchema("AssignResourceToSessionCommand", {
  id: field.id(),
  resourceId: field.id(),
  sessionId: field.id(),
  createdAt: field.optionalDate(),
});

export const removeResourceAssignmentCommandSchema = namedObjectSchema("RemoveResourceAssignmentCommand", {
  assignmentId: field.id(),
});

export const registerAttachmentCommandSchema = namedObjectSchema("RegisterAttachmentCommand", {
  id: field.id(),
  schoolId: field.id(),
  ownerKind: field.enumValue(AttachmentOwnerKind),
  ownerId: field.id(),
  fileName: field.text(),
  fileUrl: field.text(),
  mimeType: nullableOptionalText(),
  sizeBytes: field.nullablePositiveInt(),
  createdAt: field.optionalDate(),
});

export const removeAttachmentCommandSchema = namedObjectSchema("RemoveAttachmentCommand", {
  attachmentId: field.id(),
});

export const registerStudentCommandSchema = namedObjectSchema("RegisterStudentCommand", {
  id: field.id(),
  schoolId: field.id(),
  firstName: field.text(),
  lastName: field.text(),
  birthDate: field.optionalDate(),
  createdAt: field.optionalDate(),
});

export const enrollStudentCommandSchema = namedObjectSchema("EnrollStudentCommand", {
  id: field.id(),
  studentId: field.id(),
  classGroupId: field.id(),
  createdAt: field.optionalDate(),
});

export const closeEnrollmentCommandSchema = namedObjectSchema("CloseEnrollmentCommand", {
  enrollmentId: field.id(),
  endReason: field.enumValue(EnrollmentEndReason),
  endedAt: field.optionalDate(),
});

export const recordProgressionDecisionCommandSchema = namedObjectSchema("RecordProgressionDecisionCommand", {
  enrollmentId: field.id(),
  decision: field.enumValue(ProgressionDecision),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
});

export const promoteStudentCommandSchema = namedObjectSchema("PromoteStudentCommand", {
  enrollmentId: field.id(),
  nextEnrollmentId: field.id(),
  nextClassGroupId: field.id(),
  effectiveAt: field.date(),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
});

export const transferStudentCommandSchema = namedObjectSchema("TransferStudentCommand", {
  enrollmentId: field.id(),
  nextEnrollmentId: field.id(),
  nextClassGroupId: field.id(),
  effectiveAt: field.date(),
});

export const graduateStudentCommandSchema = namedObjectSchema("GraduateStudentCommand", {
  enrollmentId: field.id(),
  effectiveAt: field.date(),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
});

const guardianContactMethodSchema = namedObjectSchema("GuardianContactMethodCommandValue", {
  type: field.enumValue(GuardianContactMethodType),
  value: field.text(),
  label: optionalText(),
  isPrimary: field.optionalBoolean(),
  allowsNotifications: field.optionalBoolean(),
});

export const registerGuardianCommandSchema = namedObjectSchema("RegisterGuardianCommand", {
  id: field.id(),
  schoolId: field.id(),
  firstName: field.text(),
  lastName: field.text(),
  phone: optionalText(),
  email: z.string().email().optional(),
  contactMethods: z.array(guardianContactMethodSchema).optional(),
  hasAccess: field.optionalBoolean(),
  premiumNotificationsEnabled: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const updateStudentProfileCommandSchema = namedObjectSchema("UpdateStudentProfileCommand", {
  studentId: field.id(),
  firstName: optionalText(),
  lastName: optionalText(),
  gender: nullableOptionalText(),
  birthDate: field.optionalDate(),
  placeOfBirth: nullableOptionalText(),
  nationality: nullableOptionalText(),
  matricule: nullableOptionalText(),
  photoUrl: nullableOptionalText(),
  enrollmentDate: field.nullableDate(),
});

export const updateStudentStatusCommandSchema = namedObjectSchema("UpdateStudentStatusCommand", {
  studentId: field.id(),
  status: field.enumValue(StudentStatus),
});

export const upsertStudentHealthProfileCommandSchema = namedObjectSchema("UpsertStudentHealthProfileCommand", {
  id: field.id(),
  studentId: field.id(),
  allergies: nullableOptionalText(),
  medicalConditions: nullableOptionalText(),
  emergencyProtocols: nullableOptionalText(),
  bloodType: nullableOptionalText(),
  updatedAt: field.optionalDate(),
});

export const createStudentNoteCommandSchema = namedObjectSchema("CreateStudentNoteCommand", {
  id: field.id(),
  studentId: field.id(),
  title: optionalText(),
  body: field.text(),
  visibility: field.enumValue(StudentNoteVisibility).optional(),
  createdAt: field.optionalDate(),
});

export const updateStudentNoteCommandSchema = namedObjectSchema("UpdateStudentNoteCommand", {
  noteId: field.id(),
  title: nullableOptionalText(),
  body: optionalText(),
  visibility: field.enumValue(StudentNoteVisibility).optional(),
  updatedAt: field.optionalDate(),
});

export const updateGuardianContactMethodsCommandSchema = namedObjectSchema("UpdateGuardianContactMethodsCommand", {
  guardianId: field.id(),
  firstName: optionalText(),
  lastName: optionalText(),
  contactMethods: z.array(guardianContactMethodSchema).optional(),
  hasAccess: field.optionalBoolean(),
  premiumNotificationsEnabled: field.optionalBoolean(),
});

const guardianStudentLinkFields = {
  guardianId: field.id(),
  studentId: field.id(),
  relationship: optionalText(),
  isPrimary: field.optionalBoolean(),
  isBillingContact: field.optionalBoolean(),
  legalGuardian: field.optionalBoolean(),
  canPickup: field.optionalBoolean(),
  emergencyContactPriority: field.nullablePositiveInt(),
  receivesAcademicReports: field.optionalBoolean(),
  receivesAttendanceAlerts: field.optionalBoolean(),
  contactRestrictions: nullableOptionalText(),
  notes: nullableOptionalText(),
};

export const linkGuardianToStudentCommandSchema = namedObjectSchema("LinkGuardianToStudentCommand", {
  id: field.id(),
  ...guardianStudentLinkFields,
  createdAt: field.optionalDate(),
});

export const updateGuardianStudentLinkCommandSchema = namedObjectSchema("UpdateGuardianStudentLinkCommand", {
  ...guardianStudentLinkFields,
});

export const offerSubjectToClassCommandSchema = namedObjectSchema("OfferSubjectToClassCommand", {
  id: field.id(),
  classGroupId: field.id(),
  subjectId: field.id(),
  coefficient: field.optionalNumber(),
  createdAt: field.optionalDate(),
});

export const assignMatterToClassSubjectCommandSchema = namedObjectSchema("AssignMatterToClassSubjectCommand", {
  id: field.id(),
  classSubjectId: field.id(),
  subjectMatterId: field.id(),
  notes: optionalText(),
  updatedAt: field.optionalDate(),
});

export const recordSessionProgressCommandSchema = namedObjectSchema("RecordSessionProgressCommand", {
  id: field.id(),
  classSubjectMatterId: field.id(),
  sessionId: field.id(),
  completedPercentage: z.number().min(0).max(100),
  notes: optionalText(),
  recordedAt: field.optionalDate(),
});

export const createScheduleCommandSchema = namedObjectSchema("CreateScheduleCommand", {
  id: field.id(),
  classGroupId: field.id(),
  classSubjectId: nullableId(),
  title: field.text(),
  isRecurring: field.boolean(),
  dayOfWeek: field.enumValue(DayOfWeek).nullable().optional(),
  startTime: field.timeOfDay(),
  endTime: field.timeOfDay(),
  specificDate: field.nullableDate(),
  createdAt: field.optionalDate(),
});

export const createCalendarEventCommandSchema = namedObjectSchema("CreateCalendarEventCommand", {
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  title: field.text(),
  startDate: field.date(),
  endDate: field.date(),
  kind: field.enumValue(CalendarEventKind),
  isNonSchoolDay: field.optionalBoolean(),
  scopeKind: field.enumValue(CalendarEventScopeKind).optional(),
  scopeId: optionalText(),
  createdAt: field.optionalDate(),
});

export const generateSessionsCommandSchema = namedObjectSchema("GenerateSessionsCommand", {
  classGroupId: field.id(),
  startDate: field.date(),
  endDate: field.date(),
});

export const createSessionCommandSchema = namedObjectSchema("CreateSessionCommand", {
  id: field.id(),
  schoolId: field.id(),
  classGroupId: field.id(),
  title: field.text(),
  kind: field.enumValue(SessionKind),
  startsAt: field.date(),
  endsAt: field.date(),
  classSubjectId: optionalText(),
  createdAt: field.optionalDate(),
});

export const recordAttendanceCommandSchema = namedObjectSchema("RecordAttendanceCommand", {
  id: field.id(),
  studentId: field.id(),
  sessionId: field.id(),
  status: field.enumValue(AttendanceStatus),
  createdAt: field.optionalDate(),
});

export const recordDailyAttendanceCommandSchema = namedObjectSchema("RecordDailyAttendanceCommand", {
  id: field.id(),
  classGroupId: field.id(),
  studentId: field.id(),
  date: field.date(),
  status: field.enumValue(AttendanceStatus),
  createdAt: field.optionalDate(),
});

export const reviewAttendanceJustificationCommandSchema = namedObjectSchema("ReviewAttendanceJustificationCommand", {
  studentId: field.id(),
  sessionId: field.id(),
  decision: z.union([
    z.literal(AttendanceJustificationStatus.Excused),
    z.literal(AttendanceJustificationStatus.Rejected),
  ]),
  reason: field.text(),
  notes: optionalText(),
  reviewedAt: field.optionalDate(),
});

export const recordSessionAttendanceCommandSchema = namedObjectSchema("RecordSessionAttendanceCommand", {
  sessionId: field.id(),
  attendanceByStudent: attendanceByStudentSchema,
  createdAt: field.optionalDate(),
});

export const recordClassDailyAttendanceCommandSchema = namedObjectSchema("RecordClassDailyAttendanceCommand", {
  classGroupId: field.id(),
  date: field.date(),
  attendanceByStudent: attendanceByStudentSchema,
  createdAt: field.optionalDate(),
});

const gradeScaleRangeSchema = namedObjectSchema("GradeScaleRangeCommandValue", {
  letter: field.text(),
  minScore: field.number(),
  maxScore: field.number(),
  gpaValue: field.nullableNumber(),
  interpretation: nullableOptionalText(),
  isPassing: field.boolean(),
});

export const createGradeScaleCommandSchema = namedObjectSchema("CreateGradeScaleCommand", {
  id: field.id(),
  schoolId: field.id(),
  name: field.text(),
  minScore: field.number(),
  maxScore: field.number(),
  ranges: z.array(gradeScaleRangeSchema).min(1),
  isDefault: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const createReportCardDefinitionCommandSchema = namedObjectSchema("CreateReportCardDefinitionCommand", {
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  gradeLevelId: field.id(),
  name: field.text(),
  kind: field.enumValue(ReportCardDefinitionKind).optional(),
  isDefault: field.optionalBoolean(),
  description: nullableOptionalText(),
  createdAt: field.optionalDate(),
});

export const createAssessmentCommandSchema = namedObjectSchema("CreateAssessmentCommand", {
  id: field.id(),
  classGroupId: field.id(),
  classSubjectId: field.id(),
  periodId: field.id(),
  title: field.text(),
  kind: field.enumValue(AssessmentKind),
  maxScore: field.positiveNumber(),
  coefficient: field.optionalNumber(),
  sessionId: optionalText(),
  dueAt: field.optionalDate(),
  createdAt: field.optionalDate(),
});

export const completeAssessmentCommandSchema = namedObjectSchema("CompleteAssessmentCommand", {
  assessmentId: field.id(),
  metAt: field.optionalDate(),
});

export const recordAssessmentResultCommandSchema = namedObjectSchema("RecordAssessmentResultCommand", {
  id: field.id(),
  studentId: field.id(),
  assessmentId: field.id(),
  score: field.number(),
  createdAt: field.optionalDate(),
});

export const recordAssessmentResultComplianceCommandSchema = namedObjectSchema("RecordAssessmentResultComplianceCommand", {
  id: field.id(),
  studentId: field.id(),
  assessmentId: field.id(),
  status: field.enumValue(DeadlineComplianceStatus),
  notes: nullableOptionalText(),
  createdAt: field.optionalDate(),
});

export const createReportCardDefinitionSectionCommandSchema = namedObjectSchema("CreateReportCardDefinitionSectionCommand", {
  id: field.id(),
  reportCardDefinitionId: field.id(),
  kind: field.enumValue(ReportCardDefinitionSectionKind),
  name: field.text(),
  order: field.positiveInt(),
  weight: field.positiveNumber(),
  parentSectionId: optionalText(),
  subjectId: optionalText(),
  createdAt: field.optionalDate(),
});

export const generateReportCardResultCommandSchema = namedObjectSchema("GenerateReportCardResultCommand", {
  id: field.id(),
  studentId: field.id(),
  periodId: field.id(),
  reportCardDefinitionId: optionalText(),
  generatedAt: field.optionalDate(),
});

export const publishReportCardResultCommandSchema = namedObjectSchema("PublishReportCardResultCommand", {
  id: field.id(),
  studentId: field.id(),
  periodId: field.id(),
  reportCardDefinitionId: optionalText(),
  publishedAt: field.optionalDate(),
});

export const recordIncidentCommandSchema = namedObjectSchema("RecordIncidentCommand", {
  id: field.id(),
  schoolId: field.id(),
  title: field.text(),
  description: field.text(),
  date: field.date(),
  kind: field.enumValue(IncidentKind),
  classGroupId: optionalText(),
  sessionId: optionalText(),
  createdAt: field.optionalDate(),
});

export const addStudentInvolvementCommandSchema = namedObjectSchema("AddStudentInvolvementCommand", {
  id: field.id(),
  incidentId: field.id(),
  studentId: field.id(),
  role: field.enumValue(IncidentInvolvementRole),
  notes: optionalText(),
  createdAt: field.optionalDate(),
});

export const applyDisciplinaryActionCommandSchema = namedObjectSchema("ApplyDisciplinaryActionCommand", {
  id: field.id(),
  incidentId: field.id(),
  studentId: field.id(),
  disciplinaryActionId: field.id(),
  startsAt: field.optionalDate(),
  endsAt: field.optionalDate(),
  notes: optionalText(),
  createdAt: field.optionalDate(),
});

export const updateStudentDisciplinaryActionStatusCommandSchema = namedObjectSchema("UpdateStudentDisciplinaryActionStatusCommand", {
  studentDisciplinaryActionId: field.id(),
  status: field.enumValue(StudentDisciplinaryActionStatus),
  updatedAt: field.optionalDate(),
});

export const resolveIncidentCommandSchema = namedObjectSchema("ResolveIncidentCommand", {
  incidentId: field.id(),
  resolutionNotes: optionalText(),
  resolvedAt: field.optionalDate(),
});

const feeInstallmentTemplateCommandSchema = namedObjectSchema("FeeInstallmentTemplateCommandValue", {
  label: field.text(),
  percentage: field.positiveNumber(),
  dueDate: field.nullableDate(),
});

export const createFeeCommandSchema = namedObjectSchema("CreateFeeCommand", {
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  name: field.text(),
  category: field.enumValue(FeeCategory).optional(),
  description: nullableOptionalText(),
  defaultAmount: field.positiveNumber(),
  currency: field.text(),
  installments: z.array(feeInstallmentTemplateCommandSchema).optional(),
  createdAt: field.optionalDate(),
});

export const assignFeeToStudentCommandSchema = namedObjectSchema("AssignFeeToStudentCommand", {
  id: field.id(),
  studentId: field.id(),
  feeId: field.id(),
  expectedAmount: field.optionalNumber(),
  dueDate: field.optionalDate(),
  createdAt: field.optionalDate(),
  referenceDate: field.optionalDate(),
});

export const recordPaymentCommandSchema = namedObjectSchema("RecordPaymentCommand", {
  id: field.id(),
  studentFeeId: field.id(),
  amount: field.positiveNumber(),
  paymentDate: field.date(),
  method: field.enumValue(PaymentMethod),
  reference: optionalText(),
  notes: optionalText(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
  referenceDate: field.optionalDate(),
});

export const reversePaymentCommandSchema = namedObjectSchema("ReversePaymentCommand", {
  paymentId: field.id(),
  reversedAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
  referenceDate: field.optionalDate(),
});

export const cancelPaymentCommandSchema = namedObjectSchema("CancelPaymentCommand", {
  paymentId: field.id(),
  cancelledAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
  referenceDate: field.optionalDate(),
});

export const adjustStudentFeeCommandSchema = namedObjectSchema("AdjustStudentFeeCommand", {
  studentFeeId: field.id(),
  adjustmentAmount: field.positiveNumber(),
  reason: field.text(),
  adjustedAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
  referenceDate: field.optionalDate(),
});

export const cancelStudentFeeCommandSchema = namedObjectSchema("CancelStudentFeeCommand", {
  studentFeeId: field.id(),
  reason: field.text(),
  cancelledAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const createAnnouncementCommandSchema = namedObjectSchema("CreateAnnouncementCommand", {
  id: field.id(),
  schoolId: field.id(),
  title: field.text(),
  content: field.text(),
  priority: field.enumValue(AnnouncementPriority).optional(),
  premiumNotification: field.optionalBoolean(),
  createdAt: field.optionalDate(),
  expiresAt: field.optionalDate(),
});

export const addTargetCommandSchema = namedObjectSchema("AddAnnouncementTargetCommand", {
  id: field.id(),
  announcementId: field.id(),
  targetKind: field.enumValue(AnnouncementTargetKind),
  targetId: optionalText(),
  createdAt: field.optionalDate(),
});

export const publishAnnouncementCommandSchema = namedObjectSchema("PublishAnnouncementCommand", {
  announcementId: field.id(),
  publishedAt: field.optionalDate(),
});

export const recordDeliveryCommandSchema = namedObjectSchema("RecordMessageDeliveryCommand", {
  id: field.id(),
  announcementId: field.id(),
  recipientKind: field.enumValue(MessageDeliveryRecipientKind),
  recipientId: field.id(),
  channel: field.enumValue(MessageDeliveryChannel),
  status: field.enumValue(MessageDeliveryStatus).optional(),
  providerMessageId: optionalText(),
  failureReason: optionalText(),
  sentAt: field.optionalDate(),
  readAt: field.optionalDate(),
  createdAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
});

export const materializeDeliveriesCommandSchema = namedObjectSchema("MaterializeDeliveriesCommand", {
  announcementId: field.id(),
  channel: field.enumValue(MessageDeliveryChannel),
  createdAt: field.optionalDate(),
});
