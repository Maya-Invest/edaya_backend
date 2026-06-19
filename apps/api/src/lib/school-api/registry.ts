import { z } from "@hono/zod-openapi";
import type { AnySchema } from "@/lib/school-api/schemas/helpers";
import * as commandResponseSchemas from "@/lib/school-api/schemas/command-responses";
import * as commandSchemas from "@/lib/school-api/schemas/commands";
import * as entitySchemas from "@/lib/school-api/schemas/entities";
import * as querySchemas from "@/lib/school-api/schemas/queries";
import {
  AcademicPeriod,
  AcademicYear,
  AccessRole,
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
} from "@edaya/core";

export interface CoreCommandConfig {
  publicName: string;
  methodName: string;
  requestSchema: AnySchema;
  responseSchema: AnySchema;
  serviceOnly?: boolean;
}

export interface CoreQueryConfig {
  publicName: string;
  methodName: "getOverdueFeeCount" | "getPublishedReportCardCount" | "getSchoolOverview";
  requestSchema: AnySchema;
  responseSchema: AnySchema;
  responseShape?: "count" | "body";
}

export interface CoreEntityConfig {
  publicName: string;
  serviceName: string;
  displayName: string;
  querySchema: AnySchema;
  responseSchema: AnySchema;
  saveSchema: AnySchema;
  allowDirectSave: boolean;
  createEntity: (body: Record<string, unknown>) => unknown;
}

export const coreCommands = [
  command("register-school", "registerSchool", commandSchemas.registerSchoolCommandSchema),
  command("update-school-configuration", "updateSchoolConfiguration", commandSchemas.updateSchoolConfigurationCommandSchema),
  command("create-academic-year", "createAcademicYear", commandSchemas.createAcademicYearCommandSchema),
  command("activate-academic-year", "activateAcademicYear", commandSchemas.activateAcademicYearCommandSchema),
  command("create-academic-period", "createAcademicPeriod", commandSchemas.createAcademicPeriodCommandSchema),
  command("publish-academic-period", "publishAcademicPeriod", commandSchemas.publishAcademicPeriodCommandSchema),
  command("create-class-group", "createClassGroup", commandSchemas.createClassGroupCommandSchema),
  command("update-class-group-configuration", "updateClassGroupConfiguration", commandSchemas.updateClassGroupConfigurationCommandSchema),
  command("register-staff-member", "registerStaffMember", commandSchemas.registerStaffMemberCommandSchema),
  command("update-staff-member-status", "updateStaffMemberStatus", commandSchemas.updateStaffMemberStatusCommandSchema),
  command("link-actor-subject", "linkActorSubject", commandSchemas.linkActorSubjectCommandSchema),
  command("assign-staff-to-class", "assignStaffToClass", commandSchemas.assignStaffToClassCommandSchema),
  command("assign-staff-to-class-subject", "assignStaffToClassSubject", commandSchemas.assignStaffToClassSubjectCommandSchema),
  command("assign-staff-to-session", "assignStaffToSession", commandSchemas.assignStaffToSessionCommandSchema),
  command("assign-resource-to-class", "assignResourceToClass", commandSchemas.assignResourceToClassCommandSchema),
  command("assign-resource-to-session", "assignResourceToSession", commandSchemas.assignResourceToSessionCommandSchema),
  command("remove-resource-assignment", "removeResourceAssignment", commandSchemas.removeResourceAssignmentCommandSchema),
  command("register-attachment", "registerAttachment", commandSchemas.registerAttachmentCommandSchema),
  command("remove-attachment", "removeAttachment", commandSchemas.removeAttachmentCommandSchema),
  command("register-student", "registerStudent", commandSchemas.registerStudentCommandSchema),
  command("enroll-student", "enrollStudent", commandSchemas.enrollStudentCommandSchema),
  command("link-guardian-to-student", "linkGuardianToStudent", commandSchemas.linkGuardianToStudentCommandSchema),
  command("register-guardian", "registerGuardian", commandSchemas.registerGuardianCommandSchema),
  command("promote-student", "promoteStudent", commandSchemas.promoteStudentCommandSchema),
  command("transfer-student", "transferStudent", commandSchemas.transferStudentCommandSchema),
  command("graduate-student", "graduateStudent", commandSchemas.graduateStudentCommandSchema),
  command("close-enrollment", "closeEnrollment", commandSchemas.closeEnrollmentCommandSchema),
  command("record-progression-decision", "recordProgressionDecision", commandSchemas.recordProgressionDecisionCommandSchema),
  command("update-student-profile", "updateStudentProfile", commandSchemas.updateStudentProfileCommandSchema),
  command("update-student-status", "updateStudentStatus", commandSchemas.updateStudentStatusCommandSchema),
  command("upsert-student-health-profile", "upsertStudentHealthProfile", commandSchemas.upsertStudentHealthProfileCommandSchema),
  command("create-student-note", "createStudentNote", commandSchemas.createStudentNoteCommandSchema),
  command("update-student-note", "updateStudentNote", commandSchemas.updateStudentNoteCommandSchema),
  command("update-guardian-contact-methods", "updateGuardianContactMethods", commandSchemas.updateGuardianContactMethodsCommandSchema),
  command("update-guardian-student-link", "updateGuardianStudentLink", commandSchemas.updateGuardianStudentLinkCommandSchema),
  command("offer-subject-to-class", "offerSubjectToClass", commandSchemas.offerSubjectToClassCommandSchema),
  command("assign-matter-to-class-subject", "assignMatterToClassSubject", commandSchemas.assignMatterToClassSubjectCommandSchema),
  command("record-session-progress", "recordSessionProgress", commandSchemas.recordSessionProgressCommandSchema),
  command("create-grade-scale", "createGradeScale", commandSchemas.createGradeScaleCommandSchema),
  command("create-report-card-definition", "createReportCardDefinition", commandSchemas.createReportCardDefinitionCommandSchema),
  command("create-report-card-definition-section", "createReportCardDefinitionSection", commandSchemas.createReportCardDefinitionSectionCommandSchema),
  command("create-assessment", "createAssessment", commandSchemas.createAssessmentCommandSchema),
  command("complete-assessment", "completeAssessment", commandSchemas.completeAssessmentCommandSchema),
  command("record-assessment-result", "recordAssessmentResult", commandSchemas.recordAssessmentResultCommandSchema),
  command("record-assessment-result-compliance", "recordAssessmentResultCompliance", commandSchemas.recordAssessmentResultComplianceCommandSchema),
  command("list-class-subject-assessment-results-for-period", "listClassSubjectAssessmentResultsForPeriod", commandSchemas.listClassSubjectAssessmentResultsForPeriodCommandSchema),
  command("generate-report-card-result", "generateReportCardResult", commandSchemas.generateReportCardResultCommandSchema),
  command("publish-report-card-result", "publishReportCardResult", commandSchemas.publishReportCardResultCommandSchema),
  command("record-incident", "recordIncident", commandSchemas.recordIncidentCommandSchema),
  command("add-student-involvement", "addStudentInvolvement", commandSchemas.addStudentInvolvementCommandSchema),
  command("apply-disciplinary-action", "applyDisciplinaryAction", commandSchemas.applyDisciplinaryActionCommandSchema),
  command("update-student-disciplinary-action-status", "updateStudentDisciplinaryActionStatus", commandSchemas.updateStudentDisciplinaryActionStatusCommandSchema),
  command("resolve-incident", "resolveIncident", commandSchemas.resolveIncidentCommandSchema),
  command("create-fee", "createFee", commandSchemas.createFeeCommandSchema),
  command("assign-fee-to-student", "assignFeeToStudent", commandSchemas.assignFeeToStudentCommandSchema),
  command("record-payment", "recordPayment", commandSchemas.recordPaymentCommandSchema),
  command("reverse-payment", "reversePayment", commandSchemas.reversePaymentCommandSchema),
  command("cancel-payment", "cancelPayment", commandSchemas.cancelPaymentCommandSchema),
  command("adjust-student-fee", "adjustStudentFee", commandSchemas.adjustStudentFeeCommandSchema),
  command("cancel-student-fee", "cancelStudentFee", commandSchemas.cancelStudentFeeCommandSchema),
  command("create-schedule", "createSchedule", commandSchemas.createScheduleCommandSchema),
  command("create-calendar-event", "createCalendarEvent", commandSchemas.createCalendarEventCommandSchema),
  command("create-session", "createSession", commandSchemas.createSessionCommandSchema),
  command("generate-sessions", "generateSessions", commandSchemas.generateSessionsCommandSchema),
  command("record-attendance", "recordAttendance", commandSchemas.recordAttendanceCommandSchema),
  command("record-daily-attendance", "recordDailyAttendance", commandSchemas.recordDailyAttendanceCommandSchema),
  command("record-session-attendance", "recordSessionAttendance", commandSchemas.recordSessionAttendanceCommandSchema),
  command("record-class-daily-attendance", "recordClassDailyAttendance", commandSchemas.recordClassDailyAttendanceCommandSchema),
  command("review-attendance-justification", "reviewAttendanceJustification", commandSchemas.reviewAttendanceJustificationCommandSchema),
  command("create-announcement", "createAnnouncement", commandSchemas.createAnnouncementCommandSchema),
  command("add-target", "addTarget", commandSchemas.addTargetCommandSchema),
  command("publish-announcement", "publishAnnouncement", commandSchemas.publishAnnouncementCommandSchema),
  command("record-delivery", "recordDelivery", commandSchemas.recordDeliveryCommandSchema),
  command("materialize-deliveries", "materializeDeliveries", commandSchemas.materializeDeliveriesCommandSchema, { serviceOnly: true }),
] satisfies CoreCommandConfig[];

export const coreQueries = [
  {
    publicName: "get-overdue-fee-count",
    methodName: "getOverdueFeeCount",
    requestSchema: z.object({ schoolId: z.string().min(1) }).openapi("GetOverdueFeeCountQuery"),
    responseSchema: z.object({ count: z.number() }).openapi("CountResponse"),
    responseShape: "count",
  },
  {
    publicName: "get-published-report-card-count",
    methodName: "getPublishedReportCardCount",
    requestSchema: z.object({ schoolId: z.string().min(1) }).openapi("GetPublishedReportCardCountQuery"),
    responseSchema: z.object({ count: z.number() }).openapi("CountResponse"),
    responseShape: "count",
  },
  {
    publicName: "get-school-overview",
    methodName: "getSchoolOverview",
    requestSchema: querySchemas.getSchoolOverviewQuerySchema,
    responseSchema: querySchemas.schoolOverviewResponseSchema,
    responseShape: "body",
  },
] satisfies CoreQueryConfig[];

export const coreEntities = [
  entity("schools", "schools", "Schools", entitySchemas.schoolQuerySchema, entitySchemas.schoolResponseSchema, School),
  entity("academic-years", "academicYears", "Academic Years", entitySchemas.academicYearQuerySchema, entitySchemas.academicYearResponseSchema, AcademicYear),
  entity("academic-periods", "academicPeriods", "Academic Periods", entitySchemas.academicPeriodQuerySchema, entitySchemas.academicPeriodResponseSchema, AcademicPeriod),
  entity("period-definitions", "periodDefinitions", "Period Definitions", entitySchemas.periodDefinitionQuerySchema, entitySchemas.periodDefinitionResponseSchema, PeriodDefinition),
  entity("grade-levels", "gradeLevels", "Grade Levels", entitySchemas.gradeLevelQuerySchema, entitySchemas.gradeLevelResponseSchema, GradeLevel),
  entity("staff-members", "staffMembers", "Staff Members", entitySchemas.staffMemberQuerySchema, entitySchemas.staffMemberResponseSchema, StaffMember),
  entity("staff-assignments", "staffAssignments", "Staff Assignments", entitySchemas.staffAssignmentQuerySchema, entitySchemas.staffAssignmentResponseSchema, StaffAssignment),
  entity("access-roles", "accessRoles", "Access Roles", entitySchemas.accessRoleQuerySchema, entitySchemas.accessRoleResponseSchema, AccessRole),
  entity("staff-role-assignments", "staffRoleAssignments", "Staff Role Assignments", entitySchemas.staffRoleAssignmentQuerySchema, entitySchemas.staffRoleAssignmentResponseSchema, StaffRoleAssignment),
  entity("attachments", "attachments", "Attachments", entitySchemas.attachmentQuerySchema, entitySchemas.attachmentResponseSchema, Attachment),
  entity("resources", "resources", "Resources", entitySchemas.resourceQuerySchema, entitySchemas.resourceResponseSchema, Resource),
  entity("resource-assignments", "resourceAssignments", "Resource Assignments", entitySchemas.resourceAssignmentQuerySchema, entitySchemas.resourceAssignmentResponseSchema, ResourceAssignment),
  entity("fees", "fees", "Fees", entitySchemas.feeQuerySchema, entitySchemas.feeResponseSchema, Fee),
  entity("student-fees", "studentFees", "Student Fees", entitySchemas.studentFeeQuerySchema, entitySchemas.studentFeeResponseSchema, StudentFee, { allowDirectSave: false }),
  entity("payments", "payments", "Payments", entitySchemas.paymentQuerySchema, entitySchemas.paymentResponseSchema, Payment, { allowDirectSave: false }),
  entity("schedules", "schedules", "Schedules", entitySchemas.scheduleQuerySchema, entitySchemas.scheduleResponseSchema, Schedule),
  entity("sessions", "sessions", "Sessions", entitySchemas.sessionQuerySchema, entitySchemas.sessionResponseSchema, Session),
  entity("calendar-events", "calendarEvents", "Calendar Events", entitySchemas.calendarEventQuerySchema, entitySchemas.calendarEventResponseSchema, CalendarEvent),
  entity("attendance", "attendance", "Attendance Records", entitySchemas.attendanceQuerySchema, entitySchemas.attendanceResponseSchema, AttendanceRecord),
  entity("announcements", "announcements", "Announcements", entitySchemas.announcementQuerySchema, entitySchemas.announcementResponseSchema, Announcement),
  entity("announcement-targets", "announcementTargets", "Announcement Targets", entitySchemas.announcementTargetQuerySchema, entitySchemas.announcementTargetResponseSchema, AnnouncementTarget),
  entity("message-deliveries", "messageDeliveries", "Message Deliveries", entitySchemas.messageDeliveryQuerySchema, entitySchemas.messageDeliveryResponseSchema, MessageDelivery),
  entity("subjects", "subjects", "Subjects", entitySchemas.subjectQuerySchema, entitySchemas.subjectResponseSchema, Subject),
  entity("subject-matters", "subjectMatters", "Subject Matters", entitySchemas.subjectMatterQuerySchema, entitySchemas.subjectMatterResponseSchema, SubjectMatter),
  entity("class-groups", "classGroups", "Class Groups", entitySchemas.classGroupQuerySchema, entitySchemas.classGroupResponseSchema, ClassGroup),
  entity("class-subjects", "classSubjects", "Class Subjects", entitySchemas.classSubjectQuerySchema, entitySchemas.classSubjectResponseSchema, ClassSubject),
  entity("class-subject-matters", "classSubjectMatters", "Class Subject Matters", entitySchemas.classSubjectMatterQuerySchema, entitySchemas.classSubjectMatterResponseSchema, ClassSubjectMatter),
  entity("class-subject-progress", "classSubjectProgress", "Class Subject Progress", entitySchemas.classSubjectProgressQuerySchema, entitySchemas.classSubjectProgressResponseSchema, ClassSubjectProgress),
  entity("class-logbook-entries", "classLogbookEntries", "Class Logbook Entries", entitySchemas.classLogbookEntryQuerySchema, entitySchemas.classLogbookEntryResponseSchema, ClassLogbookEntry),
  entity("homework-assignments", "homeworkAssignments", "Homework Assignments", entitySchemas.homeworkAssignmentQuerySchema, entitySchemas.homeworkAssignmentResponseSchema, HomeworkAssignment),
  entity("homework-submissions", "homeworkSubmissions", "Homework Submissions", entitySchemas.homeworkSubmissionQuerySchema, entitySchemas.homeworkSubmissionResponseSchema, HomeworkSubmission),
  entity("activities", "activities", "Extracurricular Activities", entitySchemas.extracurricularActivityQuerySchema, entitySchemas.extracurricularActivityResponseSchema, ExtracurricularActivity),
  entity("activity-enrollments", "activityEnrollments", "Activity Enrollments", entitySchemas.activityEnrollmentQuerySchema, entitySchemas.activityEnrollmentResponseSchema, ActivityEnrollment),
  entity("assessments", "assessments", "Assessments", entitySchemas.assessmentQuerySchema, entitySchemas.assessmentResponseSchema, Assessment),
  entity("assessment-results", "assessmentResults", "Assessment Results", entitySchemas.assessmentResultQuerySchema, entitySchemas.assessmentResultResponseSchema, AssessmentResult, { allowDirectSave: false }),
  entity("grade-scales", "gradeScales", "Grade Scales", entitySchemas.gradeScaleQuerySchema, entitySchemas.gradeScaleResponseSchema, GradeScale),
  entity("definitions", "definitions", "Report Card Definitions", entitySchemas.definitionQuerySchema, entitySchemas.definitionResponseSchema, ReportCardDefinition),
  entity("sections", "sections", "Report Card Sections", entitySchemas.sectionQuerySchema, entitySchemas.sectionResponseSchema, ReportCardDefinitionSection),
  entity("results", "results", "Report Card Results", entitySchemas.resultQuerySchema, entitySchemas.resultResponseSchema, ReportCardResult, { allowDirectSave: false }),
  entity("students", "students", "Students", entitySchemas.studentQuerySchema, entitySchemas.studentResponseSchema, Student, { allowDirectSave: false }),
  entity("enrollments", "enrollments", "Student Enrollments", entitySchemas.enrollmentQuerySchema, entitySchemas.enrollmentResponseSchema, StudentClassEnrollment, { allowDirectSave: false }),
  entity("guardians", "guardians", "Guardians", entitySchemas.guardianQuerySchema, entitySchemas.guardianResponseSchema, Guardian),
  entity("guardian-links", "guardianLinks", "Guardian Student Links", entitySchemas.guardianLinkQuerySchema, entitySchemas.guardianLinkResponseSchema, GuardianStudentLink),
  entity("student-notes", "studentNotes", "Student Notes", entitySchemas.studentNoteQuerySchema, entitySchemas.studentNoteResponseSchema, StudentNote),
  entity("student-health-profiles", "studentHealthProfiles", "Student Health Profiles", entitySchemas.studentHealthProfileQuerySchema, entitySchemas.studentHealthProfileResponseSchema, StudentHealthProfile),
  entity("student-disciplinary-actions", "studentDisciplinaryActions", "Student Disciplinary Actions", entitySchemas.studentDisciplinaryActionQuerySchema, entitySchemas.studentDisciplinaryActionResponseSchema, StudentDisciplinaryAction),
  entity("disciplinary-actions", "disciplinaryActions", "Disciplinary Actions", entitySchemas.disciplinaryActionQuerySchema, entitySchemas.disciplinaryActionResponseSchema, DisciplinaryAction),
  entity("student-incident-involvements", "studentIncidentInvolvements", "Student Incident Involvements", entitySchemas.studentIncidentInvolvementQuerySchema, entitySchemas.studentIncidentInvolvementResponseSchema, StudentIncidentInvolvement),
  entity("incidents", "incidents", "Incidents", entitySchemas.incidentQuerySchema, entitySchemas.incidentResponseSchema, Incident),
] satisfies CoreEntityConfig[];

function command(
  publicName: string,
  methodName: string,
  requestSchema: AnySchema,
  options: { serviceOnly?: boolean } = {},
): CoreCommandConfig {
  return {
    publicName,
    methodName,
    requestSchema,
    responseSchema: commandResponseSchemas.resolveCommandResponseSchema(methodName),
    ...(options.serviceOnly ? { serviceOnly: true } : {}),
  };
}

interface EntityOptions {
  allowDirectSave?: boolean;
}

function entity(
  publicName: string,
  serviceName: string,
  displayName: string,
  querySchema: AnySchema,
  responseSchema: AnySchema,
  EntityClass: new (args: any) => unknown,
  options: EntityOptions = {},
): CoreEntityConfig {
  return {
    publicName,
    serviceName,
    displayName,
    querySchema,
    responseSchema,
    saveSchema: responseSchema,
    allowDirectSave: options.allowDirectSave ?? true,
    createEntity: body => new EntityClass(body),
  };
}
