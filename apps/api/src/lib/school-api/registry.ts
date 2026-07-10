import { z } from "@hono/zod-openapi";
import type { AnySchema } from "@/lib/school-api/schemas/helpers";
import * as commandResponseSchemas from "@/lib/school-api/schemas/command-responses";
import * as commandSchemas from "@/lib/school-api/schemas/commands";
import * as entitySchemas from "@/lib/school-api/schemas/entities";
import * as querySchemas from "@/lib/school-api/schemas/queries";
import { AcademicPeriod, AcademicYear, AccountInvitation, Activity, ActivityEnrollment, ActivitySession, Announcement, AnnouncementTarget, Assessment, AssessmentResult, Attachment, Attendance, AttendanceRecord, CalendarEvent, ClassActivityEnrollment, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectProgress, DisciplinaryAction, Fee, GradeLevel, GradeLevelSubject, GradeLevelSubjectMatter, GradeScale, Guardian, GuardianStudentLink, Incident, LessonSession, MessageDelivery, Payment, PeriodDefinition, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResult, Resource, ResourceAssignment, Schedule, School, SchoolNotificationTemplates, StaffAssignment, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment, StudentDisciplinaryAction, StudentFee, StudentHealthProfile, StudentIncidentInvolvement, StudentNote, Subject, SubjectMatter, Teacher, TeacherAssignment } from "@edaya/core";
import { CORE_ENTITY_KEYS } from "@edaya/service";
import type { CoreEntityKey, SchoolCommandKey } from "@edaya/service";

export interface CoreCommandConfig {
  publicName: string;
  methodName: SchoolCommandKey;
  requestSchema: AnySchema;
  responseSchema: AnySchema;
  serviceOnly?: boolean;
}

export interface CoreQueryConfig {
  publicName: string;
  methodName: "getOverdueFeeCount" | "getPublishedReportCardCount" | "getSchoolOverview" | "getAppShellCounts" | "getClassGroupTimetable" | "resolveTimetableSpace";
  requestSchema: AnySchema;
  responseSchema: AnySchema;
  responseShape?: "count" | "body";
}

export interface CoreEntityConfig {
  publicName: string;
  serviceName: CoreEntityKey;
  displayName: string;
  querySchema: AnySchema;
  responseSchema: AnySchema;
  saveSchema: AnySchema;
  allowDirectSave: boolean;
  createEntity: (body: Record<string, unknown>) => unknown;
}

interface ApiEntityDecoration {
  publicName: string;
  displayName: string;
  querySchema: AnySchema;
  responseSchema: AnySchema;
  EntityClass: new (args: any) => unknown;
  allowDirectSave?: boolean;
}

interface EntityOptions {
  allowDirectSave?: boolean;
}

function decoration(
  publicName: string,
  displayName: string,
  querySchema: AnySchema,
  responseSchema: AnySchema,
  EntityClass: new (args: any) => unknown,
  options: EntityOptions = {},
): ApiEntityDecoration {
  return {
    publicName,
    displayName,
    querySchema,
    responseSchema,
    EntityClass,
    ...(options.allowDirectSave === false ? { allowDirectSave: false } : {}),
  };
}

const apiEntityDecorations = {
  schools: decoration("schools", "Schools", entitySchemas.schoolQuerySchema, entitySchemas.schoolResponseSchema, School),
  academicYears: decoration("academic-years", "Academic Years", entitySchemas.academicYearQuerySchema, entitySchemas.academicYearResponseSchema, AcademicYear),
  academicPeriods: decoration("academic-periods", "Academic Periods", entitySchemas.academicPeriodQuerySchema, entitySchemas.academicPeriodResponseSchema, AcademicPeriod),
  periodDefinitions: decoration("period-definitions", "Period Definitions", entitySchemas.periodDefinitionQuerySchema, entitySchemas.periodDefinitionResponseSchema, PeriodDefinition),
  gradeLevels: decoration("grade-levels", "Grade Levels", entitySchemas.gradeLevelQuerySchema, entitySchemas.gradeLevelResponseSchema, GradeLevel),
  staffMembers: decoration("staff-members", "Staff Members", entitySchemas.staffMemberQuerySchema, entitySchemas.staffMemberResponseSchema, StaffMember),
  staffAssignments: decoration("staff-assignments", "Staff Assignments", entitySchemas.staffAssignmentQuerySchema, entitySchemas.staffAssignmentResponseSchema, StaffAssignment),
  accountInvitations: decoration("account-invitations", "Account Invitations", entitySchemas.accountInvitationQuerySchema, entitySchemas.accountInvitationResponseSchema, AccountInvitation, { allowDirectSave: false }),
  staffPermissionAssignments: decoration("staff-permission-assignments", "Staff Permission Assignments", entitySchemas.staffPermissionAssignmentQuerySchema, entitySchemas.staffPermissionAssignmentResponseSchema, StaffPermissionAssignment),
  attachments: decoration("attachments", "Attachments", entitySchemas.attachmentQuerySchema, entitySchemas.attachmentResponseSchema, Attachment),
  resources: decoration("resources", "Resources", entitySchemas.resourceQuerySchema, entitySchemas.resourceResponseSchema, Resource),
  resourceAssignments: decoration("resource-assignments", "Resource Assignments", entitySchemas.resourceAssignmentQuerySchema, entitySchemas.resourceAssignmentResponseSchema, ResourceAssignment),
  fees: decoration("fees", "Fees", entitySchemas.feeQuerySchema, entitySchemas.feeResponseSchema, Fee),
  studentFees: decoration("student-fees", "Student Fees", entitySchemas.studentFeeQuerySchema, entitySchemas.studentFeeResponseSchema, StudentFee, { allowDirectSave: false }),
  payments: decoration("payments", "Payments", entitySchemas.paymentQuerySchema, entitySchemas.paymentResponseSchema, Payment, { allowDirectSave: false }),
  schedules: decoration("schedules", "Schedules", entitySchemas.scheduleQuerySchema, entitySchemas.scheduleResponseSchema, Schedule),
  attendances: decoration("attendances", "Attendances", entitySchemas.attendancesQuerySchema, entitySchemas.attendanceOccurrenceResponseSchema, Attendance),
  lessonSessions: decoration("lesson-sessions", "Lesson Sessions", entitySchemas.lessonSessionQuerySchema, entitySchemas.lessonSessionResponseSchema, LessonSession),
  activitySessions: decoration("activity-sessions", "Activity Sessions", entitySchemas.activitySessionQuerySchema, entitySchemas.activitySessionResponseSchema, ActivitySession),
  calendarEvents: decoration("calendar-events", "Calendar Events", entitySchemas.calendarEventQuerySchema, entitySchemas.calendarEventResponseSchema, CalendarEvent),
  attendance: decoration("attendance", "Attendance Records", entitySchemas.attendanceQuerySchema, entitySchemas.attendanceResponseSchema, AttendanceRecord),
  announcements: decoration("announcements", "Announcements", entitySchemas.announcementQuerySchema, entitySchemas.announcementResponseSchema, Announcement),
  announcementTargets: decoration("announcement-targets", "Announcement Targets", entitySchemas.announcementTargetQuerySchema, entitySchemas.announcementTargetResponseSchema, AnnouncementTarget),
  messageDeliveries: decoration("message-deliveries", "Message Deliveries", entitySchemas.messageDeliveryQuerySchema, entitySchemas.messageDeliveryResponseSchema, MessageDelivery),
  schoolNotificationTemplates: decoration("school-notification-templates", "School Notification Templates", entitySchemas.schoolNotificationTemplatesQuerySchema, entitySchemas.schoolNotificationTemplatesResponseSchema, SchoolNotificationTemplates, { allowDirectSave: false }),
  subjects: decoration("subjects", "Subjects", entitySchemas.subjectQuerySchema, entitySchemas.subjectResponseSchema, Subject),
  subjectMatters: decoration("subject-matters", "Subject Matters", entitySchemas.subjectMatterQuerySchema, entitySchemas.subjectMatterResponseSchema, SubjectMatter),
  gradeLevelSubjects: decoration("grade-level-subjects", "Grade Level Subjects", entitySchemas.gradeLevelSubjectQuerySchema, entitySchemas.gradeLevelSubjectResponseSchema, GradeLevelSubject, { allowDirectSave: false }),
  gradeLevelSubjectMatters: decoration("grade-level-subject-matters", "Grade Level Subject Matters", entitySchemas.gradeLevelSubjectMatterQuerySchema, entitySchemas.gradeLevelSubjectMatterResponseSchema, GradeLevelSubjectMatter, { allowDirectSave: false }),
  classGroups: decoration("class-groups", "Class Groups", entitySchemas.classGroupQuerySchema, entitySchemas.classGroupResponseSchema, ClassGroup),
  classSubjects: decoration("class-subjects", "Class Subjects", entitySchemas.classSubjectQuerySchema, entitySchemas.classSubjectResponseSchema, ClassSubject, { allowDirectSave: false }),
  classSubjectMatters: decoration("class-subject-matters", "Class Subject Matters", entitySchemas.classSubjectMatterQuerySchema, entitySchemas.classSubjectMatterResponseSchema, ClassSubjectMatter),
  classSubjectProgress: decoration("class-subject-progress", "Class Subject Progress", entitySchemas.classSubjectProgressQuerySchema, entitySchemas.classSubjectProgressResponseSchema, ClassSubjectProgress),
  activities: decoration("activities", "Activities", entitySchemas.activityQuerySchema, entitySchemas.activityResponseSchema, Activity),
  activityEnrollments: decoration("activity-enrollments", "Activity Enrollments", entitySchemas.activityEnrollmentQuerySchema, entitySchemas.activityEnrollmentResponseSchema, ActivityEnrollment),
  classActivityEnrollments: decoration("class-activity-enrollments", "Class Activity Enrollments", entitySchemas.classActivityEnrollmentQuerySchema, entitySchemas.classActivityEnrollmentResponseSchema, ClassActivityEnrollment),
  assessments: decoration("assessments", "Assessments", entitySchemas.assessmentQuerySchema, entitySchemas.assessmentResponseSchema, Assessment),
  assessmentResults: decoration("assessment-results", "Assessment Results", entitySchemas.assessmentResultQuerySchema, entitySchemas.assessmentResultResponseSchema, AssessmentResult, { allowDirectSave: false }),
  gradeScales: decoration("grade-scales", "Grade Scales", entitySchemas.gradeScaleQuerySchema, entitySchemas.gradeScaleResponseSchema, GradeScale),
  definitions: decoration("definitions", "Report Card Definitions", entitySchemas.definitionQuerySchema, entitySchemas.definitionResponseSchema, ReportCardDefinition),
  sections: decoration("sections", "Report Card Sections", entitySchemas.sectionQuerySchema, entitySchemas.sectionResponseSchema, ReportCardDefinitionSection),
  results: decoration("results", "Report Card Results", entitySchemas.resultQuerySchema, entitySchemas.resultResponseSchema, ReportCardResult, { allowDirectSave: false }),
  students: decoration("students", "Students", entitySchemas.studentQuerySchema, entitySchemas.studentResponseSchema, Student, { allowDirectSave: false }),
  enrollments: decoration("enrollments", "Student Enrollments", entitySchemas.enrollmentQuerySchema, entitySchemas.enrollmentResponseSchema, StudentClassEnrollment, { allowDirectSave: false }),
  guardians: decoration("guardians", "Guardians", entitySchemas.guardianQuerySchema, entitySchemas.guardianResponseSchema, Guardian),
  teachers: decoration("teachers", "Teachers", entitySchemas.teacherQuerySchema, entitySchemas.teacherResponseSchema, Teacher),
  teacherAssignments: decoration("teacher-assignments", "Teacher Assignments", entitySchemas.teacherAssignmentQuerySchema, entitySchemas.teacherAssignmentResponseSchema, TeacherAssignment),
  guardianLinks: decoration("guardian-links", "Guardian Student Links", entitySchemas.guardianLinkQuerySchema, entitySchemas.guardianLinkResponseSchema, GuardianStudentLink),
  studentNotes: decoration("student-notes", "Student Notes", entitySchemas.studentNoteQuerySchema, entitySchemas.studentNoteResponseSchema, StudentNote),
  studentHealthProfiles: decoration("student-health-profiles", "Student Health Profiles", entitySchemas.studentHealthProfileQuerySchema, entitySchemas.studentHealthProfileResponseSchema, StudentHealthProfile),
  studentDisciplinaryActions: decoration("student-disciplinary-actions", "Student Disciplinary Actions", entitySchemas.studentDisciplinaryActionQuerySchema, entitySchemas.studentDisciplinaryActionResponseSchema, StudentDisciplinaryAction),
  disciplinaryActions: decoration("disciplinary-actions", "Disciplinary Actions", entitySchemas.disciplinaryActionQuerySchema, entitySchemas.disciplinaryActionResponseSchema, DisciplinaryAction),
  studentIncidentInvolvements: decoration("student-incident-involvements", "Student Incident Involvements", entitySchemas.studentIncidentInvolvementQuerySchema, entitySchemas.studentIncidentInvolvementResponseSchema, StudentIncidentInvolvement),
  incidents: decoration("incidents", "Incidents", entitySchemas.incidentQuerySchema, entitySchemas.incidentResponseSchema, Incident),
} satisfies Record<CoreEntityKey, ApiEntityDecoration>;

function buildCoreEntityConfig<Key extends CoreEntityKey>(
  serviceName: Key,
  entry: ApiEntityDecoration,
): CoreEntityConfig & { serviceName: Key } {
  return {
    publicName: entry.publicName,
    serviceName,
    displayName: entry.displayName,
    querySchema: entry.querySchema,
    responseSchema: entry.responseSchema,
    saveSchema: entry.responseSchema,
    allowDirectSave: entry.allowDirectSave ?? true,
    createEntity: body => new entry.EntityClass(body),
  };
}

export const coreEntities = CORE_ENTITY_KEYS.map(key =>
  buildCoreEntityConfig(key, apiEntityDecorations[key]),
) satisfies CoreEntityConfig[];

export const coreCommands = [
  command("register-school", "registerSchool", commandSchemas.registerSchoolCommandSchema),
  command("update-school-configuration", "updateSchoolConfiguration", commandSchemas.updateSchoolConfigurationCommandSchema),
  command("create-academic-year", "createAcademicYear", commandSchemas.createAcademicYearCommandSchema),
  command("activate-academic-year", "activateAcademicYear", commandSchemas.activateAcademicYearCommandSchema),
  command("create-academic-period", "createAcademicPeriod", commandSchemas.createAcademicPeriodCommandSchema),
  command("publish-academic-period", "publishAcademicPeriod", commandSchemas.publishAcademicPeriodCommandSchema),
  command("configure-grade-level", "configureGradeLevel", commandSchemas.gradeLevelConfigCommandSchema),
  command("configure-period-definition", "configurePeriodDefinition", commandSchemas.periodDefinitionConfigCommandSchema),
  command("configure-resource", "configureResource", commandSchemas.resourceConfigCommandSchema),
  command("configure-activity", "configureActivity", commandSchemas.activityConfigCommandSchema),
  command("enroll-student-in-activity", "enrollStudentInActivity", commandSchemas.activityEnrollmentConfigCommandSchema),
  command("create-class-group", "createClassGroup", commandSchemas.createClassGroupCommandSchema),
  command("update-class-group-configuration", "updateClassGroupConfiguration", commandSchemas.updateClassGroupConfigurationCommandSchema),
  command("register-staff-member", "registerStaffMember", commandSchemas.registerStaffMemberCommandSchema),
  command("update-staff-member-status", "updateStaffMemberStatus", commandSchemas.updateStaffMemberStatusCommandSchema),
  command("update-staff-member-profile", "updateStaffMemberProfile", commandSchemas.updateStaffMemberProfileCommandSchema),
  command("link-actor-subject", "linkActorSubject", commandSchemas.linkActorSubjectCommandSchema),
  command("relink-actor-subject", "relinkActorSubject", commandSchemas.relinkActorSubjectCommandSchema),
  command("unlink-actor-subject", "unlinkActorSubject", commandSchemas.unlinkActorSubjectCommandSchema),
  command("send-account-invitation", "sendAccountInvitation", commandSchemas.sendAccountInvitationCommandSchema),
  command("resend-account-invitation", "resendAccountInvitation", commandSchemas.resendAccountInvitationCommandSchema),
  command("revoke-account-invitation", "revokeAccountInvitation", commandSchemas.revokeAccountInvitationCommandSchema),
  command("accept-account-invitation", "acceptAccountInvitation", commandSchemas.acceptAccountInvitationCommandSchema, { serviceOnly: true }),
  command("assign-staff-to-class", "assignStaffToClass", commandSchemas.assignStaffToClassCommandSchema),
  command("assign-staff-to-class-subject", "assignStaffToClassSubject", commandSchemas.assignStaffToClassSubjectCommandSchema),
  command("assign-staff-to-lesson-session", "assignStaffToLessonSession", commandSchemas.assignStaffToLessonSessionCommandSchema),
  command("assign-staff-permission", "assignStaffPermission", commandSchemas.staffPermissionAssignmentConfigCommandSchema),
  command("assign-resource-to-class", "assignResourceToClass", commandSchemas.assignResourceToClassCommandSchema),
  command("assign-resource-to-lesson-session", "assignResourceToLessonSession", commandSchemas.assignResourceToLessonSessionCommandSchema),
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
  command("configure-subject", "configureSubject", commandSchemas.subjectConfigCommandSchema),
  command("configure-subject-matter", "configureSubjectMatter", commandSchemas.subjectMatterConfigCommandSchema),
  command("offer-subject-to-class", "offerSubjectToClass", commandSchemas.offerSubjectToClassCommandSchema, { serviceOnly: true }),
  command("assign-matter-to-class-subject", "assignMatterToClassSubject", commandSchemas.assignMatterToClassSubjectCommandSchema, { serviceOnly: true }),
  command("offer-subject-to-grade-level", "offerSubjectToGradeLevel", commandSchemas.offerSubjectToGradeLevelCommandSchema),
  command("remove-subject-from-grade-level", "removeSubjectFromGradeLevel", commandSchemas.removeSubjectFromGradeLevelCommandSchema),
  command("update-grade-level-subject", "updateGradeLevelSubject", commandSchemas.updateGradeLevelSubjectCommandSchema),
  command("assign-matter-to-grade-level-subject", "assignMatterToGradeLevelSubject", commandSchemas.assignMatterToGradeLevelSubjectCommandSchema),
  command("add-custom-class-subject", "addCustomClassSubject", commandSchemas.addCustomClassSubjectCommandSchema),
  command("set-class-subject-offered", "setClassSubjectOffered", commandSchemas.setClassSubjectOfferedCommandSchema),
  command("record-lesson-session-progress", "recordLessonSessionProgress", commandSchemas.recordLessonSessionProgressCommandSchema),
  command("create-grade-scale", "createGradeScale", commandSchemas.createGradeScaleCommandSchema),
  command("create-report-card-definition", "createReportCardDefinition", commandSchemas.createReportCardDefinitionCommandSchema),
  command("create-report-card-definition-section", "createReportCardDefinitionSection", commandSchemas.createReportCardDefinitionSectionCommandSchema),
  command("create-assessment", "createAssessment", commandSchemas.createAssessmentCommandSchema),
  command("complete-assessment", "completeAssessment", commandSchemas.completeAssessmentCommandSchema),
  command("record-assessment-result", "recordAssessmentResult", commandSchemas.recordAssessmentResultCommandSchema),
  command("record-assessment-result-compliance", "recordAssessmentResultCompliance", commandSchemas.recordAssessmentResultComplianceCommandSchema),
  command("list-class-subject-assessment-results-for-period", "listClassSubjectAssessmentResultsForPeriod", commandSchemas.listClassSubjectAssessmentResultsForPeriodCommandSchema),
  command("generate-report-card-result", "generateReportCardResult", commandSchemas.generateReportCardResultCommandSchema),
  command("write-homeroom-report-comment", "writeHomeroomReportComment", commandSchemas.writeHomeroomReportCommentCommandSchema),
  command("publish-report-card-result", "publishReportCardResult", commandSchemas.publishReportCardResultCommandSchema),
  command("record-incident", "recordIncident", commandSchemas.recordIncidentCommandSchema),
  command("add-student-involvement", "addStudentInvolvement", commandSchemas.addStudentInvolvementCommandSchema),
  command("configure-disciplinary-action", "configureDisciplinaryAction", commandSchemas.disciplinaryActionConfigCommandSchema),
  command("apply-disciplinary-action", "applyDisciplinaryAction", commandSchemas.applyDisciplinaryActionCommandSchema),
  command("update-student-disciplinary-action-status", "updateStudentDisciplinaryActionStatus", commandSchemas.updateStudentDisciplinaryActionStatusCommandSchema),
  command("resolve-incident", "resolveIncident", commandSchemas.resolveIncidentCommandSchema),
  command("resolve-incident-with-outcomes", "resolveIncidentWithOutcomes", commandSchemas.resolveIncidentWithOutcomesCommandSchema),
  command("create-fee", "createFee", commandSchemas.createFeeCommandSchema),
  command("assign-fee-to-student", "assignFeeToStudent", commandSchemas.assignFeeToStudentCommandSchema),
  command("record-payment", "recordPayment", commandSchemas.recordPaymentCommandSchema),
  command("reverse-payment", "reversePayment", commandSchemas.reversePaymentCommandSchema),
  command("cancel-payment", "cancelPayment", commandSchemas.cancelPaymentCommandSchema),
  command("adjust-student-fee", "adjustStudentFee", commandSchemas.adjustStudentFeeCommandSchema),
  command("cancel-student-fee", "cancelStudentFee", commandSchemas.cancelStudentFeeCommandSchema),
  command("create-schedule", "createSchedule", commandSchemas.createScheduleCommandSchema),
  command("save-schedule", "saveSchedule", commandSchemas.saveScheduleCommandSchema),
  command("materialize-schedule", "materializeSchedule", commandSchemas.materializeScheduleCommandSchema),
  command("create-calendar-event", "createCalendarEvent", commandSchemas.createCalendarEventCommandSchema),
  command("cancel-lesson-session", "cancelLessonSession", commandSchemas.cancelLessonSessionCommandSchema),
  command("cancel-activity-session", "cancelActivitySession", commandSchemas.cancelActivitySessionCommandSchema),
  command("reschedule-occurrence", "rescheduleOccurrence", commandSchemas.rescheduleOccurrenceCommandSchema),
  command("record-attendance", "recordAttendance", commandSchemas.recordAttendanceCommandSchema),
  command("record-daily-attendance", "recordDailyAttendance", commandSchemas.recordDailyAttendanceCommandSchema),
  command("record-lesson-session-attendance", "recordLessonSessionAttendance", commandSchemas.recordLessonSessionAttendanceCommandSchema),
  command("record-class-daily-attendance", "recordClassDailyAttendance", commandSchemas.recordClassDailyAttendanceCommandSchema),
  command("review-attendance-justification", "reviewAttendanceJustification", commandSchemas.reviewAttendanceJustificationCommandSchema),
  command("request-attendance-justification", "requestAttendanceJustification", commandSchemas.requestAttendanceJustificationCommandSchema),
  command("generate-class-group-timetable", "generateClassGroupTimetable", commandSchemas.generateClassGroupTimetableCommandSchema),
  command("generate-school-timetable", "generateSchoolTimetable", commandSchemas.generateSchoolTimetableCommandSchema),
  command("publish-class-group-timetable", "publishClassGroupTimetable", commandSchemas.publishClassGroupTimetableCommandSchema),
  command("republish-class-group-timetable", "republishClassGroupTimetable", commandSchemas.republishClassGroupTimetableCommandSchema),
  command("create-announcement", "createAnnouncement", commandSchemas.createAnnouncementCommandSchema),
  command("add-target", "addTarget", commandSchemas.addTargetCommandSchema),
  command("publish-announcement", "publishAnnouncement", commandSchemas.publishAnnouncementCommandSchema),
  command("record-delivery", "recordDelivery", commandSchemas.recordDeliveryCommandSchema),
  command("materialize-deliveries", "materializeDeliveries", commandSchemas.materializeDeliveriesCommandSchema, { serviceOnly: true }),
  command("apply-delivery-event", "applyDeliveryEvent", commandSchemas.applyDeliveryEventCommandSchema, { serviceOnly: true }),
  command("mark-delivery-read", "markDeliveryRead", commandSchemas.markDeliveryReadCommandSchema),
  command("update-notification-contact", "updateNotificationContact", commandSchemas.updateNotificationContactCommandSchema),
  command("register-push-device", "registerPushDevice", commandSchemas.registerPushDeviceCommandSchema),
  command("unregister-push-device", "unregisterPushDevice", commandSchemas.unregisterPushDeviceCommandSchema),
  command("update-school-notification-templates", "updateSchoolNotificationTemplates", commandSchemas.updateSchoolNotificationTemplatesCommandSchema),
  command("reset-school-notification-templates", "resetSchoolNotificationTemplates", commandSchemas.resetSchoolNotificationTemplatesCommandSchema),
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
  {
    publicName: "get-app-shell-counts",
    methodName: "getAppShellCounts",
    requestSchema: querySchemas.getAppShellCountsQuerySchema,
    responseSchema: querySchemas.appShellCountsResponseSchema,
    responseShape: "body",
  },
  {
    publicName: "get-class-group-timetable",
    methodName: "getClassGroupTimetable",
    requestSchema: querySchemas.getClassGroupTimetableQuerySchema,
    responseSchema: querySchemas.classGroupTimetableResponseSchema,
    responseShape: "body",
  },
  {
    publicName: "resolve-timetable-space",
    methodName: "resolveTimetableSpace",
    requestSchema: querySchemas.resolveTimetableSpaceQuerySchema,
    responseSchema: querySchemas.resolvedTimetableSpaceResponseSchema,
    responseShape: "body",
  },
] satisfies CoreQueryConfig[];

function command(
  publicName: string,
  methodName: SchoolCommandKey,
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
