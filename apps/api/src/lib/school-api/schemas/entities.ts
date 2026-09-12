import { z } from "@hono/zod-openapi";
import { academicPeriodSchema, academicYearSchema, AccountInvitationKind, accountInvitationSchema, AccountInvitationStatus, activityEnrollmentSchema, activitySchema, activitySessionSchema, announcementSchema, announcementTargetSchema, assessmentResultSchema, assessmentSchema, attachmentSchema, attendanceRecordSchema, attendanceSchema, calendarEventSchema, classActivityEnrollmentSchema, classGroupSchema, classSubjectMatterSchema, classSubjectProgressSchema, classSubjectSchema, attendanceSummarySchema as coreAttendanceSummarySchema, feeInstallmentTemplateSchema as coreFeeInstallmentTemplateSchema, gradeScaleRangeSchema as coreGradeScaleRangeSchema, reportCardResultSectionSchema as coreReportCardResultSectionSchema, studentFeeInstallmentSchema as coreStudentFeeInstallmentSchema, disciplinaryActionSchema, feeSchema, gradeLevelSchema, gradeLevelSubjectMatterSchema, gradeLevelSubjectSchema, gradeScaleSchema, guardianContactMethodSchema, guardianSchema, guardianStudentLinkSchema, incidentSchema, lessonSessionSchema, messageDeliverySchema, paymentSchema, periodDefinitionSchema, reportCardDefinitionSchema, reportCardDefinitionSectionSchema, reportCardResultSchema, resourceAssignmentSchema, resourceSchema, scheduleSchema, schoolSchema, staffAssignmentSchema, staffMemberSchema, staffPermissionAssignmentSchema, studentClassEnrollmentSchema, studentDisciplinaryActionSchema, studentFeeSchema, studentHealthProfileSchema, studentIncidentInvolvementSchema, studentNoteSchema, studentSchema, subjectMatterSchema, subjectSchema, TeacherAssignmentKind, teacherAssignmentSchema, TeacherAssignmentStatus, teacherSchema, TeacherUnavailabilityRecurrence, teacherUnavailabilitySchema } from "@edaya/core";
import type { AcademicPeriodInput, AcademicYearInput, AccountInvitationInput, ActivityEnrollmentInput, ActivityInput, ActivitySessionInput, AnnouncementInput, AnnouncementTargetInput, AssessmentInput, AssessmentResultInput, AttachmentInput, AttendanceInput, AttendanceRecordInput, AttendanceSummary, CalendarEventInput, ClassActivityEnrollmentInput, ClassGroupInput, ClassSubjectInput, ClassSubjectMatterInput, ClassSubjectProgressInput, DisciplinaryActionInput, FeeInput, FeeInstallmentTemplate, GradeLevelInput, GradeLevelSubjectInput, GradeLevelSubjectMatterInput, GradeScaleInput, GradeScaleRange, GuardianInput, GuardianStudentLinkInput, IncidentInput, LessonSessionInput, MessageDeliveryInput, PaymentInput, PeriodDefinitionInput, ReportCardDefinitionInput, ReportCardDefinitionSectionInput, ReportCardResultInput, ResourceAssignmentInput, ResourceInput, ScheduleInput, SchoolInput, SchoolNotificationTemplatesInput, StaffAssignmentInput, StaffMemberInput, StaffPermissionAssignmentInput, StudentClassEnrollmentInput, StudentDisciplinaryActionInput, StudentFeeInput, StudentFeeInstallment, StudentHealthProfileInput, StudentIncidentInvolvementInput, StudentInput, StudentNoteInput, SubjectInput, SubjectMatterInput, TeacherAssignmentInput, TeacherInput, TeacherUnavailabilityInput } from "@edaya/core";
import { createQueryOptionsSchema, field, lazySchema, objectFromSchema, responseSchema, unwrapShape, valueSchema } from "./helpers";

// ==========================================================
// 1. All Domain Entities Response OpenAPI Schemas
// ==========================================================

export const schoolResponseSchema = responseSchema<SchoolInput>("School", unwrapShape(schoolSchema));
export const academicYearResponseSchema = responseSchema<AcademicYearInput>("AcademicYear", unwrapShape(academicYearSchema));
export const academicPeriodResponseSchema = responseSchema<AcademicPeriodInput>("AcademicPeriod", unwrapShape(academicPeriodSchema));
export const periodDefinitionResponseSchema = responseSchema<PeriodDefinitionInput>("PeriodDefinition", unwrapShape(periodDefinitionSchema));
export const gradeLevelResponseSchema = responseSchema<GradeLevelInput>("GradeLevel", unwrapShape(gradeLevelSchema));
export const staffMemberResponseSchema = responseSchema<StaffMemberInput>("StaffMember", unwrapShape(staffMemberSchema));
export const teacherResponseSchema = responseSchema<TeacherInput>("Teacher", unwrapShape(teacherSchema));
export const teacherAssignmentResponseSchema = responseSchema<TeacherAssignmentInput>("TeacherAssignment", unwrapShape(teacherAssignmentSchema));
export const teacherUnavailabilityResponseSchema = responseSchema<TeacherUnavailabilityInput>("TeacherUnavailability", unwrapShape(teacherUnavailabilitySchema));

const { tokenHash: _accountInvitationTokenHash, ...accountInvitationShape } = unwrapShape(accountInvitationSchema);
export const accountInvitationResponseSchema = responseSchema<AccountInvitationInput>(
  "AccountInvitation",
  accountInvitationShape,
);
export const staffAssignmentResponseSchema = responseSchema<StaffAssignmentInput>("StaffAssignment", unwrapShape(staffAssignmentSchema));
export const staffPermissionAssignmentResponseSchema = responseSchema<StaffPermissionAssignmentInput>("StaffPermissionAssignment", unwrapShape(staffPermissionAssignmentSchema));
export const attachmentResponseSchema = responseSchema<AttachmentInput>("Attachment", unwrapShape(attachmentSchema));
export const resourceResponseSchema = responseSchema<ResourceInput>("Resource", unwrapShape(resourceSchema));
export const resourceAssignmentResponseSchema = responseSchema<ResourceAssignmentInput>("ResourceAssignment", unwrapShape(resourceAssignmentSchema));
export const feeInstallmentTemplateSchema = valueSchema<FeeInstallmentTemplate>(unwrapShape(coreFeeInstallmentTemplateSchema));
export const feeResponseSchema = responseSchema<FeeInput>("Fee", unwrapShape(feeSchema));
export const studentFeeInstallmentSchema = valueSchema<StudentFeeInstallment>(unwrapShape(coreStudentFeeInstallmentSchema));
export const studentFeeResponseSchema = responseSchema<StudentFeeInput>("StudentFee", unwrapShape(studentFeeSchema));
export const paymentResponseSchema = responseSchema<PaymentInput>("Payment", unwrapShape(paymentSchema));
export const scheduleResponseSchema = responseSchema<ScheduleInput>("Schedule", unwrapShape(scheduleSchema));
export const lessonSessionResponseSchema = responseSchema<LessonSessionInput>("LessonSession", unwrapShape(lessonSessionSchema));
export const activitySessionResponseSchema = responseSchema<ActivitySessionInput>("ActivitySession", unwrapShape(activitySessionSchema));
export const attendanceOccurrenceResponseSchema = responseSchema<AttendanceInput>("AttendanceOccurrence", unwrapShape(attendanceSchema));
export const calendarEventResponseSchema = responseSchema<CalendarEventInput>("CalendarEvent", unwrapShape(calendarEventSchema));
export const attendanceResponseSchema = responseSchema<AttendanceRecordInput>("Attendance", unwrapShape(attendanceRecordSchema));
export const announcementResponseSchema = responseSchema<AnnouncementInput>("Announcement", unwrapShape(announcementSchema));
export const announcementTargetResponseSchema = responseSchema<AnnouncementTargetInput>("AnnouncementTarget", unwrapShape(announcementTargetSchema));
export const messageDeliveryResponseSchema = responseSchema<MessageDeliveryInput>("MessageDelivery", unwrapShape(messageDeliverySchema));

/** OpenAPI/GraphQL-safe: catalog keys contain dots (e.g. announcement.published). */
const schoolNotificationTemplateDocumentApiSchema = z.record(z.string(), z.unknown()).openapi(
  "SchoolNotificationTemplateDocument",
  { type: "object", additionalProperties: true },
);

export const schoolNotificationTemplatesResponseSchema = responseSchema<SchoolNotificationTemplatesInput>(
  "SchoolNotificationTemplates",
  {
    schoolId: field.id(),
    templates: schoolNotificationTemplateDocumentApiSchema,
    createdAt: field.date(),
    updatedAt: field.date(),
  },
);
export const subjectResponseSchema = responseSchema<SubjectInput>("Subject", unwrapShape(subjectSchema));
export const subjectMatterResponseSchema = responseSchema<SubjectMatterInput>("SubjectMatter", unwrapShape(subjectMatterSchema));
export const gradeLevelSubjectResponseSchema = responseSchema<GradeLevelSubjectInput>("GradeLevelSubject", unwrapShape(gradeLevelSubjectSchema));
export const gradeLevelSubjectMatterResponseSchema = responseSchema<GradeLevelSubjectMatterInput>("GradeLevelSubjectMatter", unwrapShape(gradeLevelSubjectMatterSchema));
export const classGroupResponseSchema = responseSchema<ClassGroupInput>("ClassGroup", unwrapShape(classGroupSchema));
export const classSubjectResponseSchema = responseSchema<ClassSubjectInput>("ClassSubject", unwrapShape(classSubjectSchema));
export const classSubjectMatterResponseSchema = responseSchema<ClassSubjectMatterInput>("ClassSubjectMatter", unwrapShape(classSubjectMatterSchema));
export const classSubjectProgressResponseSchema = responseSchema<ClassSubjectProgressInput>("ClassSubjectProgress", unwrapShape(classSubjectProgressSchema));
export const activityResponseSchema = responseSchema<ActivityInput>("Activity", unwrapShape(activitySchema));
export const activityEnrollmentResponseSchema = responseSchema<ActivityEnrollmentInput>("ActivityEnrollment", unwrapShape(activityEnrollmentSchema));
export const classActivityEnrollmentResponseSchema = responseSchema<ClassActivityEnrollmentInput>("ClassActivityEnrollment", unwrapShape(classActivityEnrollmentSchema));
export const assessmentResponseSchema = responseSchema<AssessmentInput>("Assessment", unwrapShape(assessmentSchema));
export const assessmentResultResponseSchema = responseSchema<AssessmentResultInput>("AssessmentResult", unwrapShape(assessmentResultSchema));
export const gradeScaleRangeSchema = valueSchema<GradeScaleRange>(unwrapShape(coreGradeScaleRangeSchema));
export const gradeScaleResponseSchema = responseSchema<GradeScaleInput>("GradeScale", unwrapShape(gradeScaleSchema));
export const definitionResponseSchema = responseSchema<ReportCardDefinitionInput>("ReportCardDefinition", unwrapShape(reportCardDefinitionSchema));
export const sectionResponseSchema = responseSchema<ReportCardDefinitionSectionInput>("ReportCardDefinitionSection", unwrapShape(reportCardDefinitionSectionSchema));
export const reportCardResultSectionSchema = lazySchema(() => coreReportCardResultSectionSchema)
  .openapi("ReportCardResultSection", { type: "object" });
export const resultResponseSchema = responseSchema<ReportCardResultInput>("ReportCardResult", {
  ...unwrapShape(reportCardResultSchema),
  sectionResults: z.array(reportCardResultSectionSchema),
  attendanceSummary: valueSchema<AttendanceSummary>({
    ...unwrapShape(coreAttendanceSummarySchema),
    total: z.number(),
    attendanceRate: z.number(),
  }),
});
export const studentResponseSchema = responseSchema<StudentInput>("Student", unwrapShape(studentSchema));
export const enrollmentResponseSchema = responseSchema<StudentClassEnrollmentInput>("StudentClassEnrollment", unwrapShape(studentClassEnrollmentSchema));
export const guardianResponseSchema = responseSchema<GuardianInput>("Guardian", {
  ...unwrapShape(guardianSchema),
  contactMethods: z.array(objectFromSchema(guardianContactMethodSchema)),
});
export const guardianLinkResponseSchema = responseSchema<GuardianStudentLinkInput>("GuardianStudentLink", unwrapShape(guardianStudentLinkSchema));
export const studentNoteResponseSchema = responseSchema<StudentNoteInput>("StudentNote", unwrapShape(studentNoteSchema));
export const studentHealthProfileResponseSchema = responseSchema<StudentHealthProfileInput>("StudentHealthProfile", unwrapShape(studentHealthProfileSchema));
export const studentDisciplinaryActionResponseSchema = responseSchema<StudentDisciplinaryActionInput>("StudentDisciplinaryAction", unwrapShape(studentDisciplinaryActionSchema));
export const disciplinaryActionResponseSchema = responseSchema<DisciplinaryActionInput>("DisciplinaryAction", unwrapShape(disciplinaryActionSchema));
export const studentIncidentInvolvementResponseSchema = responseSchema<StudentIncidentInvolvementInput>("StudentIncidentInvolvement", unwrapShape(studentIncidentInvolvementSchema));
export const incidentResponseSchema = responseSchema<IncidentInput>("Incident", unwrapShape(incidentSchema));

// ==========================================================
// 2. All 42 Query Filter (QueryOptions) OpenAPI Schemas
// ==========================================================

export const schoolQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  name: field.string(),
});

export const academicYearQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  name: field.string(),
  status: field.string(),
});

export const academicPeriodQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  name: field.string(),
});

export const periodDefinitionQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  dayOfWeek: field.string(),
  isTeachingSlot: field.boolean(),
  name: field.string(),
});

export const gradeLevelQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  name: field.string(),
});

export const staffMemberQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  firstName: field.string(),
  lastName: field.string(),
  code: field.string(),
  isActive: field.boolean(),
});

export const teacherQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  firstName: field.string(),
  lastName: field.string(),
  code: field.string(),
  email: field.string(),
  isActive: field.boolean(),
});

export const teacherAssignmentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  teacherId: field.id(),
  academicYearId: field.id(),
  kind: z.nativeEnum(TeacherAssignmentKind),
  classSubjectId: field.id(),
  classGroupId: field.id(),
  status: z.nativeEnum(TeacherAssignmentStatus),
});

export const teacherUnavailabilityQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  teacherId: field.id(),
  academicYearId: field.id(),
  recurrence: z.nativeEnum(TeacherUnavailabilityRecurrence),
  dayOfWeek: field.string(),
  isActive: field.boolean(),
});

export const staffAssignmentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  staffId: field.id(),
  academicYearId: field.id(),
  classGroupId: field.id(),
  classSubjectId: field.id(),
  lessonSessionId: field.id(),
  activitySessionId: field.id(),
  assessmentId: field.id(),
  responsibility: field.string(),
});

export const accountInvitationQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  kind: z.nativeEnum(AccountInvitationKind),
  targetId: field.id(),
  status: z.nativeEnum(AccountInvitationStatus),
});

export const staffPermissionAssignmentQuerySchema = createQueryOptionsSchema({
  id: field.string(),
  staffId: field.string(),
  schoolId: field.string(),
  academicYearId: field.string(),
  permission: field.string(),
  status: field.string(),
  sourceStaffAssignmentId: field.string(),
});

export const attachmentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  fileName: field.string(),
  mimeType: field.string(),
});

export const resourceQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  name: field.string(),
  kind: field.string(),
});

export const resourceAssignmentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  resourceId: field.id(),
  lessonSessionId: field.id(),
  activitySessionId: field.id(),
  assessmentId: field.id(),
  classGroupId: field.id(),
});

export const feeQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  name: field.string(),
});

export const studentFeeQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  studentId: field.id(),
  feeId: field.id(),
  status: field.string(),
});

export const paymentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  studentFeeId: field.id(),
  method: field.string(),
  status: field.string(),
});

export const scheduleQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  classGroupId: field.id(),
  classSubjectId: field.id(),
  scheduleKind: field.string(),
  title: field.string(),
});

export const lessonSessionQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  classGroupId: field.id(),
  scheduleId: field.id(),
  timetableGenerated: field.string(),
  classSubjectId: field.id(),
  status: field.string(),
  displayLabel: field.string(),
});

export const activitySessionQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  classGroupId: field.id(),
  scheduleId: field.id(),
  activityId: field.id(),
  status: field.string(),
  displayLabel: field.string(),
});

export const attendancesQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  classGroupId: field.id(),
  displayLabel: field.string(),
});

export const calendarEventQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  title: field.string(),
});

export const attendanceQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  studentId: field.id(),
  attendanceId: field.id(),
  lessonSessionId: field.id(),
  activitySessionId: field.id(),
  assessmentId: field.id(),
  status: field.string(),
});

export const announcementQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  title: field.string(),
  status: field.string(),
});

export const announcementTargetQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  announcementId: field.id(),
  targetKind: field.string(),
  targetId: field.id(),
});

export const messageDeliveryQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  announcementId: field.id(),
  subjectId: field.id(),
  recipientKind: field.string(),
  recipientId: field.id(),
  status: field.string(),
});

export const schoolNotificationTemplatesQuerySchema = createQueryOptionsSchema({
  schoolId: field.id(),
});

export const subjectQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  name: field.string(),
  code: field.string(),
});

export const subjectMatterQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  subjectId: field.id(),
  name: field.string(),
});

export const classGroupQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  gradeLevelId: field.id(),
  academicYearId: field.id(),
  homeroomStaffId: field.id(),
  name: field.string(),
});

export const classSubjectQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  classGroupId: field.id(),
  subjectId: field.id(),
  gradeLevelSubjectId: field.id(),
  periodsPerWeek: field.number(),
});

export const gradeLevelSubjectQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  gradeLevelId: field.id(),
  academicYearId: field.id(),
  subjectId: field.id(),
  periodsPerWeek: field.number(),
});

export const gradeLevelSubjectMatterQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  gradeLevelSubjectId: field.id(),
  subjectMatterId: field.id(),
});

export const classSubjectMatterQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  classSubjectId: field.id(),
  subjectMatterId: field.id(),
  status: field.string(),
});

export const classSubjectProgressQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  classSubjectMatterId: field.id(),
  lessonSessionId: field.id(),
});

export const activityQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  name: field.string(),
  category: field.string(),
  coach: field.string(),
});

export const activityEnrollmentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  activityId: field.id(),
  studentId: field.id(),
  status: field.string(),
});

export const classActivityEnrollmentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  activityId: field.id(),
  classGroupId: field.id(),
});

export const assessmentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  classSubjectId: field.id(),
  classGroupId: field.id(),
  periodId: field.id(),
  title: field.string(),
  kind: field.string(),
});

export const assessmentResultQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  assessmentId: field.id(),
  studentId: field.id(),
  status: field.string(),
});

export const gradeScaleQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  name: field.string(),
  isDefault: field.boolean(),
});

export const definitionQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  academicYearId: field.id(),
  name: field.string(),
});

export const sectionQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  reportCardDefinitionId: field.id(),
  name: field.string(),
});

export const resultQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  studentId: field.id(),
  reportCardDefinitionId: field.id(),
  classGroupId: field.id(),
  periodId: field.id(),
  status: field.string(),
});

export const studentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  firstName: field.string(),
  lastName: field.string(),
  status: field.string(),
  matricule: field.string(),
});

export const enrollmentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  studentId: field.id(),
  classGroupId: field.id(),
  academicYearId: field.id(),
  status: field.string(),
});

export const guardianQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  firstName: field.string(),
  lastName: field.string(),
  code: field.string(),
  email: field.string(),
});

export const guardianLinkQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  guardianId: field.id(),
  studentId: field.id(),
  relationship: field.string(),
});

export const studentNoteQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  studentId: field.id(),
  title: field.string(),
});

export const studentHealthProfileQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  studentId: field.id(),
});

export const studentDisciplinaryActionQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  studentId: field.id(),
  disciplinaryActionId: field.id(),
});

export const disciplinaryActionQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  name: field.string(),
});

export const studentIncidentInvolvementQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  studentId: field.id(),
  incidentId: field.id(),
  role: field.string(),
});

export const incidentQuerySchema = createQueryOptionsSchema({
  id: field.id(),
  schoolId: field.id(),
  title: field.string(),
});
