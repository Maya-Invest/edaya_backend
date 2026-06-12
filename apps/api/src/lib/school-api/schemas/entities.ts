import { z } from "@hono/zod-openapi";
import {
  academicPeriodSchema,
  academicYearSchema,
  accessRoleSchema,
  announcementSchema,
  announcementTargetSchema,
  assessmentResultSchema,
  assessmentSchema,
  attachmentSchema,
  attendanceRecordSchema,
  calendarEventSchema,
  classGroupSchema,
  classLogbookEntrySchema,
  classSubjectMatterSchema,
  classSubjectProgressSchema,
  classSubjectSchema,
  attendanceSummarySchema as coreAttendanceSummarySchema,
  feeInstallmentTemplateSchema as coreFeeInstallmentTemplateSchema,
  gradeScaleRangeSchema as coreGradeScaleRangeSchema,
  reportCardResultSectionSchema as coreReportCardResultSectionSchema,
  studentFeeInstallmentSchema as coreStudentFeeInstallmentSchema,
  disciplinaryActionSchema,
  feeSchema,
  gradeLevelSchema,
  gradeScaleSchema,
  homeworkAssignmentSchema,
  homeworkAttachmentSchema as coreHomeworkAttachmentSchema,
  homeworkSubmissionSchema,
  guardianContactMethodSchema,
  guardianSchema,
  guardianStudentLinkSchema,
  incidentSchema,
  messageDeliverySchema,
  paymentSchema,
  periodDefinitionSchema,
  reportCardDefinitionSchema,
  reportCardDefinitionSectionSchema,
  reportCardResultSchema,
  resourceAssignmentSchema,
  resourceSchema,
  scheduleSchema,
  // Zod schemas imported from core
  schoolSchema,
  scopeGrantSchema,
  sessionSchema,
  staffAssignmentSchema,
  staffMemberSchema,
  staffRoleAssignmentSchema,
  studentClassEnrollmentSchema,
  studentDisciplinaryActionSchema,
  studentFeeSchema,
  studentHealthProfileSchema,
  studentIncidentInvolvementSchema,
  studentNoteSchema,
  studentSchema,
  subjectMatterSchema,
  subjectSchema,
} from "@edaya/core";
import type {
  AcademicPeriodInput,
  AcademicYearInput,
  AccessRoleInput,
  AnnouncementInput,
  AnnouncementTargetInput,
  AssessmentInput,
  AssessmentResultInput,
  AttachmentInput,
  AttendanceRecordInput,
  AttendanceSummary,
  CalendarEventInput,
  ClassGroupInput,
  ClassLogbookEntryInput,
  ClassSubjectInput,
  ClassSubjectMatterInput,
  ClassSubjectProgressInput,
  DisciplinaryActionInput,
  FeeInput,
  FeeInstallmentTemplate,
  GradeLevelInput,
  GradeScaleInput,
  GradeScaleRange,
  HomeworkAssignmentInput,
  HomeworkAttachment,
  HomeworkSubmissionInput,
  GuardianInput,
  GuardianStudentLinkInput,
  IncidentInput,
  MessageDeliveryInput,
  PaymentInput,
  PeriodDefinitionInput,
  ReportCardDefinitionInput,
  ReportCardDefinitionSectionInput,
  ReportCardResultInput,
  ResourceAssignmentInput,
  ResourceInput,
  ScheduleInput,
  SchoolInput,
  ScopeGrant,
  SessionInput,
  StaffAssignmentInput,
  StaffMemberInput,
  StaffRoleAssignmentInput,
  StudentClassEnrollmentInput,
  StudentDisciplinaryActionInput,
  StudentFeeInput,
  StudentFeeInstallment,
  StudentHealthProfileInput,
  StudentIncidentInvolvementInput,
  StudentInput,
  StudentNoteInput,
  SubjectInput,
  SubjectMatterInput,
} from "@edaya/core";
import { createQueryOptionsSchema, field, responseSchema, unwrapShape, valueSchema } from "./helpers";

// ==========================================================
// 1. All Domain Entities Response OpenAPI Schemas
// ==========================================================

export const schoolResponseSchema = responseSchema<SchoolInput>("School", unwrapShape(schoolSchema));
export const academicYearResponseSchema = responseSchema<AcademicYearInput>("AcademicYear", unwrapShape(academicYearSchema));
export const academicPeriodResponseSchema = responseSchema<AcademicPeriodInput>("AcademicPeriod", unwrapShape(academicPeriodSchema));
export const periodDefinitionResponseSchema = responseSchema<PeriodDefinitionInput>("PeriodDefinition", unwrapShape(periodDefinitionSchema));
export const gradeLevelResponseSchema = responseSchema<GradeLevelInput>("GradeLevel", unwrapShape(gradeLevelSchema));
export const staffMemberResponseSchema = responseSchema<StaffMemberInput>("StaffMember", unwrapShape(staffMemberSchema));
export const staffAssignmentResponseSchema = responseSchema<StaffAssignmentInput>("StaffAssignment", unwrapShape(staffAssignmentSchema));
export const scopeGrantResponseSchema = valueSchema<ScopeGrant>(unwrapShape(scopeGrantSchema));
export const accessRoleResponseSchema = responseSchema<AccessRoleInput>("AccessRole", unwrapShape(accessRoleSchema));
export const staffRoleAssignmentResponseSchema = responseSchema<StaffRoleAssignmentInput>("StaffRoleAssignment", unwrapShape(staffRoleAssignmentSchema));
export const attachmentResponseSchema = responseSchema<AttachmentInput>("Attachment", unwrapShape(attachmentSchema));
export const resourceResponseSchema = responseSchema<ResourceInput>("Resource", unwrapShape(resourceSchema));
export const resourceAssignmentResponseSchema = responseSchema<ResourceAssignmentInput>("ResourceAssignment", unwrapShape(resourceAssignmentSchema));
export const feeInstallmentTemplateSchema = valueSchema<FeeInstallmentTemplate>(unwrapShape(coreFeeInstallmentTemplateSchema));
export const feeResponseSchema = responseSchema<FeeInput>("Fee", unwrapShape(feeSchema));
export const studentFeeInstallmentSchema = valueSchema<StudentFeeInstallment>(unwrapShape(coreStudentFeeInstallmentSchema));
export const studentFeeResponseSchema = responseSchema<StudentFeeInput>("StudentFee", unwrapShape(studentFeeSchema));
export const paymentResponseSchema = responseSchema<PaymentInput>("Payment", unwrapShape(paymentSchema));
export const scheduleResponseSchema = responseSchema<ScheduleInput>("Schedule", unwrapShape(scheduleSchema));
export const sessionResponseSchema = responseSchema<SessionInput>("Session", unwrapShape(sessionSchema));
export const calendarEventResponseSchema = responseSchema<CalendarEventInput>("CalendarEvent", unwrapShape(calendarEventSchema));
export const attendanceResponseSchema = responseSchema<AttendanceRecordInput>("Attendance", unwrapShape(attendanceRecordSchema));
export const announcementResponseSchema = responseSchema<AnnouncementInput>("Announcement", unwrapShape(announcementSchema));
export const announcementTargetResponseSchema = responseSchema<AnnouncementTargetInput>("AnnouncementTarget", unwrapShape(announcementTargetSchema));
export const messageDeliveryResponseSchema = responseSchema<MessageDeliveryInput>("MessageDelivery", unwrapShape(messageDeliverySchema));
export const subjectResponseSchema = responseSchema<SubjectInput>("Subject", unwrapShape(subjectSchema));
export const subjectMatterResponseSchema = responseSchema<SubjectMatterInput>("SubjectMatter", unwrapShape(subjectMatterSchema));
export const classGroupResponseSchema = responseSchema<ClassGroupInput>("ClassGroup", unwrapShape(classGroupSchema));
export const classSubjectResponseSchema = responseSchema<ClassSubjectInput>("ClassSubject", unwrapShape(classSubjectSchema));
export const classSubjectMatterResponseSchema = responseSchema<ClassSubjectMatterInput>("ClassSubjectMatter", unwrapShape(classSubjectMatterSchema));
export const classSubjectProgressResponseSchema = responseSchema<ClassSubjectProgressInput>("ClassSubjectProgress", unwrapShape(classSubjectProgressSchema));
export const classLogbookEntryResponseSchema = responseSchema<ClassLogbookEntryInput>("ClassLogbookEntry", {
  ...unwrapShape(classLogbookEntrySchema),
  objectives: z.array(z.string()),
  attachments: z.array(z.string()),
});
export const homeworkAttachmentResponseSchema = valueSchema<HomeworkAttachment>(unwrapShape(coreHomeworkAttachmentSchema));
export const homeworkAssignmentResponseSchema = responseSchema<HomeworkAssignmentInput>("HomeworkAssignment", {
  ...unwrapShape(homeworkAssignmentSchema),
  attachments: z.array(homeworkAttachmentResponseSchema),
});
export const homeworkSubmissionResponseSchema = responseSchema<HomeworkSubmissionInput>("HomeworkSubmission", unwrapShape(homeworkSubmissionSchema));
export const assessmentResponseSchema = responseSchema<AssessmentInput>("Assessment", unwrapShape(assessmentSchema));
export const assessmentResultResponseSchema = responseSchema<AssessmentResultInput>("AssessmentResult", unwrapShape(assessmentResultSchema));
export const gradeScaleRangeSchema = valueSchema<GradeScaleRange>(unwrapShape(coreGradeScaleRangeSchema));
export const gradeScaleResponseSchema = responseSchema<GradeScaleInput>("GradeScale", unwrapShape(gradeScaleSchema));
export const definitionResponseSchema = responseSchema<ReportCardDefinitionInput>("ReportCardDefinition", unwrapShape(reportCardDefinitionSchema));
export const sectionResponseSchema = responseSchema<ReportCardDefinitionSectionInput>("ReportCardDefinitionSection", unwrapShape(reportCardDefinitionSectionSchema));
export const reportCardResultSectionSchema: any = (z.lazy(() => coreReportCardResultSectionSchema as any) as any).openapi("ReportCardResultSection", { type: "object" });
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
  contactMethods: z.array(z.object(unwrapShape(guardianContactMethodSchema) as any)),
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

export const classLogbookEntryQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  classGroupId: field.uuid(),
  classSubjectId: field.uuid(),
  chapter: field.string(),
});

export const homeworkAssignmentQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  schoolId: field.uuid(),
  classGroupId: field.uuid(),
  classSubjectId: field.uuid(),
  title: field.string(),
  type: field.string(),
});

export const homeworkSubmissionQuerySchema = createQueryOptionsSchema({
  id: field.uuid(),
  homeworkAssignmentId: field.uuid(),
  studentId: field.uuid(),
  status: field.string(),
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
