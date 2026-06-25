import { z } from "@hono/zod-openapi";
import {
  academicPeriodSchema,
  academicYearSchema,
  accessRoleSchema,
  AccountInvitationContactChannel,
  AccountInvitationKind,
  announcementSchema,
  announcementTargetSchema,
  assessmentResultSchema,
  assessmentSchema,
  attachmentSchema,
  AttendanceJustificationStatus,
  attendanceRecordSchema,
  AttendanceStatus,
  calendarEventSchema,
  classGroupSchema,
  classSubjectMatterSchema,
  classSubjectProgressSchema,
  classSubjectSchema,
  gradeScaleRangeSchema as coreGradeScaleRangeSchema,
  DeadlineComplianceStatus,
  disciplinaryActionSchema,
  EnrollmentEndReason,
  feeSchema,
  gradeLevelSchema,
  gradeScaleSchema,
  guardianContactMethodSchema,
  guardianSchema,
  guardianStudentLinkSchema,
  incidentSchema,
  messageDeliverySchema,
  NOTIFICATION_TEMPLATE_KEYS,
  paymentSchema,
  periodDefinitionSchema,
  ProgressionDecision,
  reportCardDefinitionSchema,
  reportCardDefinitionSectionSchema,
  reportCardResultSchema,
  resourceAssignmentSchema,
  resourceSchema,
  scheduleSchema,
  // Zod schemas from core
  schoolSchema,
  SchoolType,
  sessionSchema,
  staffAssignmentSchema,
  staffMemberSchema,
  staffRoleAssignmentSchema,
  studentClassEnrollmentSchema,
  studentDisciplinaryActionSchema,
  StudentDisciplinaryActionStatus,
  studentFeeSchema,
  studentHealthProfileSchema,
  studentIncidentInvolvementSchema,
  studentNoteSchema,
  studentSchema,
  StudentStatus,
  subjectMatterSchema,
  subjectSchema,
} from "@edaya/core";
import { field, namedObjectSchema, objectFromSchema } from "./helpers";

const optionalText = () => z.string().optional();
const attendanceByStudentSchema = z.record(field.id(), field.enumValue(AttendanceStatus));

export const gradeLevelConfigCommandSchema = objectFromSchema(gradeLevelSchema).openapi("GradeLevelConfigCommand");

export const periodDefinitionConfigCommandSchema = objectFromSchema(periodDefinitionSchema)
  .omit({ schoolId: true })
  .openapi("PeriodDefinitionConfigCommand");

export const resourceConfigCommandSchema = objectFromSchema(resourceSchema)
  .omit({ schoolId: true })
  .openapi("ResourceConfigCommand");

export const subjectConfigCommandSchema = objectFromSchema(subjectSchema)
  .omit({ schoolId: true })
  .openapi("SubjectConfigCommand");

export const subjectMatterConfigCommandSchema = objectFromSchema(subjectMatterSchema)
  .openapi("SubjectMatterConfigCommand");

export const disciplinaryActionConfigCommandSchema = objectFromSchema(disciplinaryActionSchema)
  .omit({ schoolId: true })
  .openapi("DisciplinaryActionConfigCommand");

export const registerSchoolCommandSchema = objectFromSchema(schoolSchema)
  .extend({
    type: z.nativeEnum(SchoolType).nullable().optional(),
    country: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
  })
  .openapi("RegisterSchoolCommand");

export const updateSchoolConfigurationCommandSchema = objectFromSchema(schoolSchema)
  .partial()
  .omit({ id: true, createdAt: true })
  .extend({
    schoolId: field.id(),
    type: z.nativeEnum(SchoolType).nullable().optional(),
    country: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
  })
  .openapi("UpdateSchoolConfigurationCommand");

export const createAcademicYearCommandSchema = objectFromSchema(academicYearSchema)
  .extend({
    isActive: field.optionalBoolean(),
  })
  .openapi("CreateAcademicYearCommand");

export const activateAcademicYearCommandSchema = z.object({
  academicYearId: field.id(),
}).openapi("ActivateAcademicYearCommand");

export const publishAcademicPeriodCommandSchema = z.object({
  academicPeriodId: field.id(),
}).openapi("PublishAcademicPeriodCommand");

export const createAcademicPeriodCommandSchema = objectFromSchema(academicPeriodSchema)
  .openapi("CreateAcademicPeriodCommand");

export const createClassGroupCommandSchema = objectFromSchema(classGroupSchema)
  .openapi("CreateClassGroupCommand");

export const updateClassGroupConfigurationCommandSchema = objectFromSchema(classGroupSchema)
  .partial()
  .omit({ id: true, schoolId: true, academicYearId: true, gradeLevelId: true, createdAt: true })
  .extend({
    classGroupId: field.id(),
  })
  .openapi("UpdateClassGroupConfigurationCommand");

export const registerStaffMemberCommandSchema = objectFromSchema(staffMemberSchema)
  .extend({
    sendAccountInvitation: field.optionalBoolean(),
  })
  .openapi("RegisterStaffMemberCommand");

export const updateStaffMemberStatusCommandSchema = z.object({
  staffId: field.id(),
  isActive: field.boolean(),
}).openapi("UpdateStaffMemberStatusCommand");

export const updateStaffMemberProfileCommandSchema = objectFromSchema(staffMemberSchema)
  .partial()
  .omit({
    id: true,
    schoolId: true,
    isActive: true,
    createdAt: true,
    subjectId: true,
    accountKind: true,
    serviceId: true,
    createdBySubjectId: true,
    serviceElevated: true,
    notificationEmail: true,
    notificationPhone: true,
  })
  .extend({
    staffId: field.id(),
  })
  .openapi("UpdateStaffMemberProfileCommand");

export const linkActorSubjectCommandSchema = z.object({
  subjectId: field.id(),
  staffMemberId: field.id().optional(),
  guardianId: field.id().optional(),
  studentId: field.id().optional(),
}).superRefine((data, ctx) => {
  const targetCount = [data.staffMemberId, data.guardianId, data.studentId].filter(Boolean).length;
  if (targetCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one of staffMemberId, guardianId, or studentId is required",
    });
  }
}).openapi("LinkActorSubjectCommand");

export const sendAccountInvitationCommandSchema = z.object({
  kind: field.enumValue(AccountInvitationKind),
  targetId: field.id(),
  contactChannel: field.enumValue(AccountInvitationContactChannel).optional(),
  contactValue: field.optionalString(),
}).openapi("SendAccountInvitationCommand");

export const resendAccountInvitationCommandSchema = z.object({
  invitationId: field.id(),
}).openapi("ResendAccountInvitationCommand");

export const revokeAccountInvitationCommandSchema = z.object({
  invitationId: field.id(),
}).openapi("RevokeAccountInvitationCommand");

export const acceptAccountInvitationCommandSchema = z.object({
  token: z.string().min(1),
  subjectId: field.id(),
  contactEmail: z.string().email(),
}).openapi("AcceptAccountInvitationCommand");

export const assignStaffToClassCommandSchema = objectFromSchema(staffAssignmentSchema)
  .omit({ classSubjectId: true, sessionId: true })
  .extend({
    classGroupId: field.id(),
  })
  .openapi("AssignStaffToClassCommand");

export const assignStaffToClassSubjectCommandSchema = objectFromSchema(staffAssignmentSchema)
  .omit({ classGroupId: true, sessionId: true })
  .extend({
    classSubjectId: field.id(),
  })
  .openapi("AssignStaffToClassSubjectCommand");

export const assignStaffToSessionCommandSchema = objectFromSchema(staffAssignmentSchema)
  .omit({ classGroupId: true, classSubjectId: true })
  .extend({
    sessionId: field.id(),
  })
  .openapi("AssignStaffToSessionCommand");

export const accessRoleConfigCommandSchema = objectFromSchema(accessRoleSchema)
  .openapi("AccessRoleConfigCommand");

export const staffRoleAssignmentConfigCommandSchema = objectFromSchema(staffRoleAssignmentSchema)
  .openapi("StaffRoleAssignmentConfigCommand");

export const assignResourceToClassCommandSchema = objectFromSchema(resourceAssignmentSchema)
  .omit({ sessionId: true })
  .extend({
    classGroupId: field.id(),
  })
  .openapi("AssignResourceToClassCommand");

export const assignResourceToSessionCommandSchema = objectFromSchema(resourceAssignmentSchema)
  .omit({ classGroupId: true })
  .extend({
    sessionId: field.id(),
  })
  .openapi("AssignResourceToSessionCommand");

export const removeResourceAssignmentCommandSchema = z.object({
  assignmentId: field.id(),
}).openapi("RemoveResourceAssignmentCommand");

export const registerAttachmentCommandSchema = objectFromSchema(attachmentSchema)
  .omit({ uploadedById: true })
  .openapi("RegisterAttachmentCommand");

export const removeAttachmentCommandSchema = z.object({
  attachmentId: field.id(),
}).openapi("RemoveAttachmentCommand");

export const registerStudentCommandSchema = objectFromSchema(studentSchema)
  .omit({
    gender: true,
    placeOfBirth: true,
    nationality: true,
    matricule: true,
    photoUrl: true,
    subjectId: true,
    status: true,
    enrollmentDate: true,
  })
  .extend({
    sendAccountInvitation: field.optionalBoolean(),
    inviteEmail: field.optionalString(),
  })
  .openapi("RegisterStudentCommand");

export const enrollStudentCommandSchema = objectFromSchema(studentClassEnrollmentSchema)
  .omit({
    academicYearId: true,
    enrollmentIndex: true,
    status: true,
    endedAt: true,
    endReason: true,
    progressionDecision: true,
    previousEnrollmentId: true,
    closedBy: true,
    progressionDecidedAt: true,
    progressionDecidedBy: true,
    progressionNotes: true,
  })
  .openapi("EnrollStudentCommand");

export const closeEnrollmentCommandSchema = z.object({
  enrollmentId: field.id(),
  endReason: z.nativeEnum(EnrollmentEndReason),
  endedAt: field.optionalDate(),
}).openapi("CloseEnrollmentCommand");

export const recordProgressionDecisionCommandSchema = z.object({
  enrollmentId: field.id(),
  decision: z.nativeEnum(ProgressionDecision),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
}).openapi("RecordProgressionDecisionCommand");

export const promoteStudentCommandSchema = z.object({
  enrollmentId: field.id(),
  nextEnrollmentId: field.id(),
  nextClassGroupId: field.id(),
  effectiveAt: field.date(),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
}).openapi("PromoteStudentCommand");

export const transferStudentCommandSchema = z.object({
  enrollmentId: field.id(),
  nextEnrollmentId: field.id(),
  nextClassGroupId: field.id(),
  effectiveAt: field.date(),
}).openapi("TransferStudentCommand");

export const graduateStudentCommandSchema = z.object({
  enrollmentId: field.id(),
  effectiveAt: field.date(),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
}).openapi("GraduateStudentCommand");

export const registerGuardianCommandSchema = objectFromSchema(guardianSchema)
  .extend({
    contactMethods: z.array(objectFromSchema(guardianContactMethodSchema)).optional(),
    sendAccountInvitation: field.optionalBoolean(),
  })
  .openapi("RegisterGuardianCommand");

export const updateStudentProfileCommandSchema = objectFromSchema(studentSchema)
  .partial()
  .omit({ id: true, schoolId: true, status: true, createdAt: true })
  .extend({
    studentId: field.id(),
  })
  .openapi("UpdateStudentProfileCommand");

export const updateStudentStatusCommandSchema = z.object({
  studentId: field.id(),
  status: z.nativeEnum(StudentStatus),
}).openapi("UpdateStudentStatusCommand");

export const upsertStudentHealthProfileCommandSchema = objectFromSchema(studentHealthProfileSchema)
  .omit({ schoolId: true })
  .openapi("UpsertStudentHealthProfileCommand");

export const createStudentNoteCommandSchema = objectFromSchema(studentNoteSchema)
  .omit({ schoolId: true, authorStaffId: true })
  .openapi("CreateStudentNoteCommand");

export const updateStudentNoteCommandSchema = objectFromSchema(studentNoteSchema)
  .partial()
  .omit({ id: true, schoolId: true, studentId: true, authorStaffId: true, createdAt: true })
  .extend({
    noteId: field.id(),
  })
  .openapi("UpdateStudentNoteCommand");

export const updateGuardianContactMethodsCommandSchema = objectFromSchema(guardianSchema)
  .partial()
  .omit({ id: true, schoolId: true, subjectId: true, createdAt: true })
  .extend({
    guardianId: field.id(),
    contactMethods: z.array(objectFromSchema(guardianContactMethodSchema)).optional(),
  })
  .openapi("UpdateGuardianContactMethodsCommand");

export const linkGuardianToStudentCommandSchema = objectFromSchema(guardianStudentLinkSchema)
  .omit({ schoolId: true })
  .openapi("LinkGuardianToStudentCommand");

export const updateGuardianStudentLinkCommandSchema = objectFromSchema(guardianStudentLinkSchema)
  .partial()
  .omit({ id: true, schoolId: true, createdAt: true })
  .openapi("UpdateGuardianStudentLinkCommand");

export const offerSubjectToClassCommandSchema = objectFromSchema(classSubjectSchema)
  .omit({ completedPercentage: true })
  .openapi("OfferSubjectToClassCommand");

export const assignMatterToClassSubjectCommandSchema = objectFromSchema(classSubjectMatterSchema)
  .omit({ status: true, completedPercentage: true, updatedByStaffId: true, startedAt: true, completedAt: true })
  .openapi("AssignMatterToClassSubjectCommand");

export const recordSessionProgressCommandSchema = objectFromSchema(classSubjectProgressSchema)
  .omit({ recordedByStaffId: true })
  .openapi("RecordSessionProgressCommand");

export const createScheduleCommandSchema = objectFromSchema(scheduleSchema)
  .openapi("CreateScheduleCommand");

export const createCalendarEventCommandSchema = objectFromSchema(calendarEventSchema)
  .openapi("CreateCalendarEventCommand");

export const generateSessionsCommandSchema = z.object({
  classGroupId: field.id(),
  startDate: field.date(),
  endDate: field.date(),
}).openapi("GenerateSessionsCommand");

export const createSessionCommandSchema = objectFromSchema(sessionSchema)
  .omit({ schoolId: true })
  .openapi("CreateSessionCommand");

export const recordAttendanceCommandSchema = objectFromSchema(attendanceRecordSchema)
  .omit({
    date: true,
    justificationStatus: true,
    reason: true,
    notes: true,
    justifiedAt: true,
    justifiedByStaffId: true,
    correctedAt: true,
    correctedByStaffId: true,
    createdBy: true,
    updatedAt: true,
  })
  .openapi("RecordAttendanceCommand");

export const recordDailyAttendanceCommandSchema = objectFromSchema(attendanceRecordSchema)
  .omit({
    sessionId: true,
    justificationStatus: true,
    reason: true,
    notes: true,
    justifiedAt: true,
    justifiedByStaffId: true,
    correctedAt: true,
    correctedByStaffId: true,
    createdBy: true,
    updatedAt: true,
  })
  .extend({
    classGroupId: field.id(),
  })
  .openapi("RecordDailyAttendanceCommand");

export const reviewAttendanceJustificationCommandSchema = z.object({
  studentId: field.id(),
  sessionId: field.id(),
  decision: z.union([
    z.literal(AttendanceJustificationStatus.Excused),
    z.literal(AttendanceJustificationStatus.Rejected),
  ]),
  reason: field.text(),
  notes: optionalText(),
  reviewedAt: field.optionalDate(),
}).openapi("ReviewAttendanceJustificationCommand");

export const recordSessionAttendanceCommandSchema = z.object({
  sessionId: field.id(),
  attendanceByStudent: attendanceByStudentSchema,
  createdAt: field.optionalDate(),
}).openapi("RecordSessionAttendanceCommand");

export const recordClassDailyAttendanceCommandSchema = z.object({
  classGroupId: field.id(),
  date: field.date(),
  attendanceByStudent: attendanceByStudentSchema,
  createdAt: field.optionalDate(),
}).openapi("RecordClassDailyAttendanceCommand");

const gradeScaleRangeCommandSchema = objectFromSchema(coreGradeScaleRangeSchema)
  .openapi("GradeScaleRangeCommandValue");

export const createGradeScaleCommandSchema = objectFromSchema(gradeScaleSchema)
  .extend({
    ranges: z.array(gradeScaleRangeCommandSchema).min(1),
  })
  .openapi("CreateGradeScaleCommand");

export const createReportCardDefinitionCommandSchema = objectFromSchema(reportCardDefinitionSchema)
  .openapi("CreateReportCardDefinitionCommand");

export const createAssessmentCommandSchema = objectFromSchema(assessmentSchema)
  .omit({ metAt: true, date: true })
  .openapi("CreateAssessmentCommand");

export const completeAssessmentCommandSchema = z.object({
  assessmentId: field.id(),
  metAt: field.optionalDate(),
}).openapi("CompleteAssessmentCommand");

export const recordAssessmentResultCommandSchema = objectFromSchema(assessmentResultSchema)
  .omit({ status: true, notes: true, createdBy: true })
  .openapi("RecordAssessmentResultCommand");

export const recordAssessmentResultComplianceCommandSchema = objectFromSchema(assessmentResultSchema)
  .omit({ score: true, createdBy: true })
  .extend({
    status: z.nativeEnum(DeadlineComplianceStatus),
  })
  .openapi("RecordAssessmentResultComplianceCommand");

export const createReportCardDefinitionSectionCommandSchema = objectFromSchema(reportCardDefinitionSectionSchema)
  .openapi("CreateReportCardDefinitionSectionCommand");

export const generateReportCardResultCommandSchema = objectFromSchema(reportCardResultSchema)
  .omit({
    classGroupId: true,
    periodId: true,
    sectionResults: true,
    attendanceSummary: true,
    assessmentResultCount: true,
    overallAverage: true,
    rank: true,
    classSize: true,
    passThreshold: true,
    teacherComment: true,
    principalComment: true,
    status: true,
    publishedAt: true,
  })
  .extend({
    reportCardDefinitionId: optionalText(),
    periodId: field.id(),
  })
  .openapi("GenerateReportCardResultCommand");

export const publishReportCardResultCommandSchema = z.object({
  id: field.id(),
  studentId: field.id(),
  periodId: field.id(),
  reportCardDefinitionId: optionalText(),
  publishedAt: field.optionalDate(),
}).openapi("PublishReportCardResultCommand");

export const recordIncidentCommandSchema = objectFromSchema(incidentSchema)
  .omit({
    reporterId: true,
    status: true,
    resolutionNotes: true,
    resolvedAt: true,
    resolvedByStaffId: true,
  })
  .openapi("RecordIncidentCommand");

export const addStudentInvolvementCommandSchema = objectFromSchema(studentIncidentInvolvementSchema)
  .openapi("AddStudentInvolvementCommand");

export const applyDisciplinaryActionCommandSchema = objectFromSchema(studentDisciplinaryActionSchema)
  .omit({
    assignedByStaffId: true,
    status: true,
  })
  .openapi("ApplyDisciplinaryActionCommand");

export const updateStudentDisciplinaryActionStatusCommandSchema = z.object({
  studentDisciplinaryActionId: field.id(),
  status: z.nativeEnum(StudentDisciplinaryActionStatus),
  updatedAt: field.optionalDate(),
}).openapi("UpdateStudentDisciplinaryActionStatusCommand");

export const resolveIncidentCommandSchema = z.object({
  incidentId: field.id(),
  resolutionNotes: optionalText(),
  resolvedAt: field.optionalDate(),
}).openapi("ResolveIncidentCommand");

const feeInstallmentTemplateCommandSchema = namedObjectSchema("FeeInstallmentTemplateCommandValue", {
  label: field.text(),
  percentage: field.positiveNumber(),
  dueDate: field.nullableDate(),
});

export const createFeeCommandSchema = objectFromSchema(feeSchema)
  .extend({
    installments: z.array(feeInstallmentTemplateCommandSchema).optional(),
  })
  .openapi("CreateFeeCommand");

export const assignFeeToStudentCommandSchema = objectFromSchema(studentFeeSchema)
  .omit({
    academicYearId: true,
    adjustmentAmount: true,
    adjustmentReason: true,
    adjustedById: true,
    adjustedAt: true,
    paidAmount: true,
    currency: true,
    status: true,
    cancellationReason: true,
    cancelledById: true,
    cancelledAt: true,
    installments: true,
    updatedAt: true,
  })
  .extend({
    expectedAmount: field.optionalNumber(),
    dueDate: field.optionalDate(),
    referenceDate: field.optionalDate(),
  })
  .openapi("AssignFeeToStudentCommand");

export const recordPaymentCommandSchema = objectFromSchema(paymentSchema)
  .omit({
    currency: true,
    status: true,
    recordedById: true,
    reversedAt: true,
    reversedById: true,
    cancelledAt: true,
    cancelledById: true,
  })
  .extend({
    referenceDate: field.optionalDate(),
  })
  .openapi("RecordPaymentCommand");

export const reversePaymentCommandSchema = z.object({
  paymentId: field.id(),
  reversedAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
  referenceDate: field.optionalDate(),
}).openapi("ReversePaymentCommand");

export const cancelPaymentCommandSchema = z.object({
  paymentId: field.id(),
  cancelledAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
  referenceDate: field.optionalDate(),
}).openapi("CancelPaymentCommand");

export const adjustStudentFeeCommandSchema = z.object({
  studentFeeId: field.id(),
  adjustmentAmount: field.positiveNumber(),
  reason: field.text(),
  adjustedAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
  referenceDate: field.optionalDate(),
}).openapi("AdjustStudentFeeCommand");

export const cancelStudentFeeCommandSchema = z.object({
  studentFeeId: field.id(),
  reason: field.text(),
  cancelledAt: field.optionalDate(),
  updatedAt: field.optionalDate(),
}).openapi("CancelStudentFeeCommand");

export const createAnnouncementCommandSchema = objectFromSchema(announcementSchema)
  .omit({
    status: true,
    publishedAt: true,
  })
  .openapi("CreateAnnouncementCommand");

export const addTargetCommandSchema = objectFromSchema(announcementTargetSchema)
  .openapi("AddAnnouncementTargetCommand");

export const publishAnnouncementCommandSchema = z.object({
  announcementId: field.id(),
  publishedAt: field.optionalDate(),
}).openapi("PublishAnnouncementCommand");

export const recordDeliveryCommandSchema = objectFromSchema(messageDeliverySchema)
  .openapi("RecordMessageDeliveryCommand");

export const materializeDeliveriesCommandSchema = z.object({
  announcementId: field.id(),
}).openapi("MaterializeDeliveriesCommand");

export const applyDeliveryEventCommandSchema = z.object({
  deliveryId: field.id(),
  status: z.enum(["sent", "failed", "read", "cancelled"]),
  providerMessageId: field.optionalString(),
  failureReason: field.optionalString(),
  occurredAt: field.optionalDate(),
}).openapi("ApplyDeliveryEventCommand");

export const markDeliveryReadCommandSchema = z.object({
  deliveryId: field.id(),
  readAt: field.optionalDate(),
}).openapi("MarkDeliveryReadCommand");

export const updateNotificationContactCommandSchema = z.object({
  notificationEmail: field.optionalString().nullable(),
  notificationPhone: field.optionalString().nullable(),
}).openapi("UpdateNotificationContactCommand");

export const updateSchoolNotificationTemplatesCommandSchema = z.object({
  schoolId: field.id(),
  templates: z.record(z.string(), z.unknown()).openapi("SchoolNotificationTemplateDocumentPatch", {
    type: "object",
    additionalProperties: true,
  }),
  expectedUpdatedAt: field.optionalDate(),
}).openapi("UpdateSchoolNotificationTemplatesCommand");

export const resetSchoolNotificationTemplatesCommandSchema = z.object({
  schoolId: field.id(),
  templateKey: z.enum(NOTIFICATION_TEMPLATE_KEYS).optional(),
}).openapi("ResetSchoolNotificationTemplatesCommand");

export const listClassSubjectAssessmentResultsForPeriodCommandSchema = z.object({
  classSubjectId: field.id(),
  periodId: field.id(),
}).openapi("ListClassSubjectAssessmentResultsForPeriodCommand");
