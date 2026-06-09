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
  classSubjectMatterSchema,
  classSubjectProgressSchema,
  classSubjectSchema,
  feeInstallmentTemplateSchema as coreFeeInstallmentTemplateSchema,
  gradeScaleRangeSchema as coreGradeScaleRangeSchema,
  reportCardResultSectionSchema as coreReportCardResultSectionSchema,
  studentFeeInstallmentSchema as coreStudentFeeInstallmentSchema,
  disciplinaryActionSchema,
  feeSchema,
  gradeLevelSchema,
  gradeScaleSchema,
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
  ResourceArgs,
  ResourceAssignmentArgs,
  ScheduleArgs,
  SchoolArgs,
  ScopeGrant,
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
import { field, responseSchema, unwrapShape, valueSchema } from "./utils/schema-fields";

// ==========================================================
// 1. All Domain Entities Response OpenAPI Schemas
// ==========================================================

export const schoolResponseSchema = responseSchema<SchoolArgs>("School", unwrapShape(schoolSchema));
export const academicYearResponseSchema = responseSchema<AcademicYearArgs>("AcademicYear", unwrapShape(academicYearSchema));
export const academicPeriodResponseSchema = responseSchema<AcademicPeriodArgs>("AcademicPeriod", unwrapShape(academicPeriodSchema));
export const periodDefinitionResponseSchema = responseSchema<PeriodDefinitionArgs>("PeriodDefinition", unwrapShape(periodDefinitionSchema));
export const gradeLevelResponseSchema = responseSchema<GradeLevelArgs>("GradeLevel", unwrapShape(gradeLevelSchema));
export const staffMemberResponseSchema = responseSchema<StaffMemberArgs>("StaffMember", unwrapShape(staffMemberSchema));
export const staffAssignmentResponseSchema = responseSchema<StaffAssignmentArgs>("StaffAssignment", unwrapShape(staffAssignmentSchema));
export const scopeGrantResponseSchema = valueSchema<ScopeGrant>(unwrapShape(scopeGrantSchema));
export const accessRoleResponseSchema = responseSchema<AccessRoleArgs>("AccessRole", unwrapShape(accessRoleSchema));
export const staffRoleAssignmentResponseSchema = responseSchema<StaffRoleAssignmentArgs>("StaffRoleAssignment", unwrapShape(staffRoleAssignmentSchema));
export const attachmentResponseSchema = responseSchema<AttachmentArgs>("Attachment", unwrapShape(attachmentSchema));
export const resourceResponseSchema = responseSchema<ResourceArgs>("Resource", unwrapShape(resourceSchema));
export const resourceAssignmentResponseSchema = responseSchema<ResourceAssignmentArgs>("ResourceAssignment", unwrapShape(resourceAssignmentSchema));
export const feeInstallmentTemplateSchema = valueSchema<FeeInstallmentTemplate>(unwrapShape(coreFeeInstallmentTemplateSchema));
export const feeResponseSchema = responseSchema<FeeArgs>("Fee", unwrapShape(feeSchema));
export const studentFeeInstallmentSchema = valueSchema<StudentFeeInstallment>(unwrapShape(coreStudentFeeInstallmentSchema));
export const studentFeeResponseSchema = responseSchema<StudentFeeArgs>("StudentFee", unwrapShape(studentFeeSchema));
export const paymentResponseSchema = responseSchema<PaymentArgs>("Payment", unwrapShape(paymentSchema));
export const scheduleResponseSchema = responseSchema<ScheduleArgs>("Schedule", unwrapShape(scheduleSchema));
export const sessionResponseSchema = responseSchema<SessionArgs>("Session", unwrapShape(sessionSchema));
export const calendarEventResponseSchema = responseSchema<CalendarEventArgs>("CalendarEvent", unwrapShape(calendarEventSchema));
export const attendanceResponseSchema = responseSchema<AttendanceRecordArgs>("Attendance", unwrapShape(attendanceRecordSchema));
export const announcementResponseSchema = responseSchema<AnnouncementArgs>("Announcement", unwrapShape(announcementSchema));
export const announcementTargetResponseSchema = responseSchema<AnnouncementTargetArgs>("AnnouncementTarget", unwrapShape(announcementTargetSchema));
export const messageDeliveryResponseSchema = responseSchema<MessageDeliveryArgs>("MessageDelivery", unwrapShape(messageDeliverySchema));
export const subjectResponseSchema = responseSchema<SubjectArgs>("Subject", unwrapShape(subjectSchema));
export const subjectMatterResponseSchema = responseSchema<SubjectMatterArgs>("SubjectMatter", unwrapShape(subjectMatterSchema));
export const classGroupResponseSchema = responseSchema<ClassGroupArgs>("ClassGroup", unwrapShape(classGroupSchema));
export const classSubjectResponseSchema = responseSchema<ClassSubjectArgs>("ClassSubject", unwrapShape(classSubjectSchema));
export const classSubjectMatterResponseSchema = responseSchema<ClassSubjectMatterArgs>("ClassSubjectMatter", unwrapShape(classSubjectMatterSchema));
export const classSubjectProgressResponseSchema = responseSchema<ClassSubjectProgressArgs>("ClassSubjectProgress", unwrapShape(classSubjectProgressSchema));
export const assessmentResponseSchema = responseSchema<AssessmentArgs>("Assessment", unwrapShape(assessmentSchema));
export const assessmentResultResponseSchema = responseSchema<AssessmentResultArgs>("AssessmentResult", unwrapShape(assessmentResultSchema));
export const gradeScaleRangeSchema = valueSchema<GradeScaleRange>(unwrapShape(coreGradeScaleRangeSchema));
export const gradeScaleResponseSchema = responseSchema<GradeScaleArgs>("GradeScale", unwrapShape(gradeScaleSchema));
export const definitionResponseSchema = responseSchema<ReportCardDefinitionArgs>("ReportCardDefinition", unwrapShape(reportCardDefinitionSchema));
export const sectionResponseSchema = responseSchema<ReportCardDefinitionSectionArgs>("ReportCardDefinitionSection", unwrapShape(reportCardDefinitionSectionSchema));
export const reportCardResultSectionSchema: any = (z.lazy(() => coreReportCardResultSectionSchema as any) as any).openapi("ReportCardResultSection", { type: "object" });
export const resultResponseSchema = responseSchema<ReportCardResultArgs>("ReportCardResult", {
  ...unwrapShape(reportCardResultSchema),
  sectionResults: z.array(reportCardResultSectionSchema),
  attendanceSummary: valueSchema<AttendanceSummary>({
    presentCount: z.number(),
    absenceCount: z.number(),
    excusedAbsenceCount: z.number(),
    lateCount: z.number(),
    total: z.number(),
    attendanceRate: z.number(),
  }),
});
export const studentResponseSchema = responseSchema<StudentArgs>("Student", unwrapShape(studentSchema));
export const enrollmentResponseSchema = responseSchema<StudentClassEnrollmentArgs>("StudentClassEnrollment", unwrapShape(studentClassEnrollmentSchema));
export const guardianResponseSchema = responseSchema<GuardianArgs>("Guardian", {
  ...unwrapShape(guardianSchema),
  contactMethods: z.array(z.object({
    type: z.string(),
    value: z.string(),
    label: z.string().nullable().optional(),
    isPrimary: z.boolean().optional(),
  })),
});
export const guardianLinkResponseSchema = responseSchema<GuardianStudentLinkArgs>("GuardianStudentLink", unwrapShape(guardianStudentLinkSchema));
export const studentNoteResponseSchema = responseSchema<StudentNoteArgs>("StudentNote", unwrapShape(studentNoteSchema));
export const studentHealthProfileResponseSchema = responseSchema<StudentHealthProfileArgs>("StudentHealthProfile", unwrapShape(studentHealthProfileSchema));
export const studentDisciplinaryActionResponseSchema = responseSchema<StudentDisciplinaryActionArgs>("StudentDisciplinaryAction", unwrapShape(studentDisciplinaryActionSchema));
export const disciplinaryActionResponseSchema = responseSchema<DisciplinaryActionArgs>("DisciplinaryAction", unwrapShape(disciplinaryActionSchema));
export const studentIncidentInvolvementResponseSchema = responseSchema<StudentIncidentInvolvementArgs>("StudentIncidentInvolvement", unwrapShape(studentIncidentInvolvementSchema));
export const incidentResponseSchema = responseSchema<IncidentArgs>("Incident", unwrapShape(incidentSchema));

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
