import type { PublicEntityOperations } from "./public-operations";
import { COMMAND_ONLY, PUBLIC_CRUD, PUBLIC_DELETE } from "./public-operations";
import type { CoreEntityKey, SchoolCommandKey } from "@edaya/service";
import type { AnySchema } from "@/lib/school-api/schemas/helpers";
import { AcademicPeriod, AcademicYear, AccountInvitation, Activity, ActivityEnrollment, ActivitySession, Announcement, AnnouncementTarget, Assessment, AssessmentResult, Attachment, Attendance, AttendanceRecord, CalendarEvent, ClassActivityEnrollment, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectProgress, DisciplinaryAction, Fee, GradeLevel, GradeLevelSubject, GradeLevelSubjectMatter, GradeScale, Guardian, GuardianStudentLink, Incident, LessonSession, MessageDelivery, Payment, PeriodDefinition, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResult, Resource, ResourceAssignment, Schedule, School, SchoolNotificationTemplates, StaffAssignment, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment, StudentDisciplinaryAction, StudentFee, StudentHealthProfile, StudentIncidentInvolvement, StudentNote, StudentPhotoSubmission, Subject, SubjectMatter, Teacher, TeacherAssignment, TeacherUnavailability } from "@edaya/core";
import { CORE_ENTITY_KEYS } from "@edaya/service";
import { z } from "@hono/zod-openapi";
import * as commandResponseSchemas from "@/lib/school-api/schemas/command-responses";
import * as commandSchemas from "@/lib/school-api/schemas/commands";
import * as entitySchemas from "@/lib/school-api/schemas/entities";
import * as querySchemas from "@/lib/school-api/schemas/queries";

export interface CoreCommandConfig {
  publicName: string;
  methodName: SchoolCommandKey;
  requestSchema: AnySchema;
  responseSchema: AnySchema;
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
  publicOperations: PublicEntityOperations;
  createEntity: (body: Record<string, unknown>) => unknown;
}

interface ApiEntityDecoration {
  publicName: string;
  displayName: string;
  querySchema: AnySchema;
  responseSchema: AnySchema;
  EntityClass: new (args: any) => unknown;
  publicOperations: PublicEntityOperations;
}

function decoration(
  publicName: string,
  displayName: string,
  querySchema: AnySchema,
  responseSchema: AnySchema,
  EntityClass: new (args: any) => unknown,
  publicOperations: PublicEntityOperations,
): ApiEntityDecoration {
  return {
    publicName,
    displayName,
    querySchema,
    responseSchema,
    EntityClass,
    publicOperations,
  };
}

const apiEntityDecorations = {
  schools: decoration("schools", "Schools", entitySchemas.schoolQuerySchema, entitySchemas.schoolResponseSchema, School, PUBLIC_CRUD),
  academicYears: decoration("academic-years", "Academic Years", entitySchemas.academicYearQuerySchema, entitySchemas.academicYearResponseSchema, AcademicYear, PUBLIC_CRUD),
  academicPeriods: decoration("academic-periods", "Academic Periods", entitySchemas.academicPeriodQuerySchema, entitySchemas.academicPeriodResponseSchema, AcademicPeriod, PUBLIC_CRUD),
  periodDefinitions: decoration("period-definitions", "Period Definitions", entitySchemas.periodDefinitionQuerySchema, entitySchemas.periodDefinitionResponseSchema, PeriodDefinition, PUBLIC_CRUD),
  gradeLevels: decoration("grade-levels", "Grade Levels", entitySchemas.gradeLevelQuerySchema, entitySchemas.gradeLevelResponseSchema, GradeLevel, PUBLIC_CRUD),
  staffMembers: decoration("staff-members", "Staff Members", entitySchemas.staffMemberQuerySchema, entitySchemas.staffMemberResponseSchema, StaffMember, PUBLIC_CRUD),
  staffAssignments: decoration("staff-assignments", "Staff Assignments", entitySchemas.staffAssignmentQuerySchema, entitySchemas.staffAssignmentResponseSchema, StaffAssignment, PUBLIC_CRUD),
  accountInvitations: decoration("account-invitations", "Account Invitations", entitySchemas.accountInvitationQuerySchema, entitySchemas.accountInvitationResponseSchema, AccountInvitation, COMMAND_ONLY),
  staffPermissionAssignments: decoration("staff-permission-assignments", "Staff Permission Assignments", entitySchemas.staffPermissionAssignmentQuerySchema, entitySchemas.staffPermissionAssignmentResponseSchema, StaffPermissionAssignment, PUBLIC_CRUD),
  attachments: decoration("attachments", "Attachments", entitySchemas.attachmentQuerySchema, entitySchemas.attachmentResponseSchema, Attachment, COMMAND_ONLY),
  resources: decoration("resources", "Resources", entitySchemas.resourceQuerySchema, entitySchemas.resourceResponseSchema, Resource, PUBLIC_CRUD),
  resourceAssignments: decoration("resource-assignments", "Resource Assignments", entitySchemas.resourceAssignmentQuerySchema, entitySchemas.resourceAssignmentResponseSchema, ResourceAssignment, PUBLIC_CRUD),
  fees: decoration("fees", "Fees", entitySchemas.feeQuerySchema, entitySchemas.feeResponseSchema, Fee, PUBLIC_CRUD),
  studentFees: decoration("student-fees", "Student Fees", entitySchemas.studentFeeQuerySchema, entitySchemas.studentFeeResponseSchema, StudentFee, COMMAND_ONLY),
  payments: decoration("payments", "Payments", entitySchemas.paymentQuerySchema, entitySchemas.paymentResponseSchema, Payment, COMMAND_ONLY),
  schedules: decoration("schedules", "Schedules", entitySchemas.scheduleQuerySchema, entitySchemas.scheduleResponseSchema, Schedule, PUBLIC_CRUD),
  attendances: decoration("attendances", "Attendances", entitySchemas.attendancesQuerySchema, entitySchemas.attendanceOccurrenceResponseSchema, Attendance, PUBLIC_CRUD),
  lessonSessions: decoration("lesson-sessions", "Lesson Sessions", entitySchemas.lessonSessionQuerySchema, entitySchemas.lessonSessionResponseSchema, LessonSession, PUBLIC_CRUD),
  activitySessions: decoration("activity-sessions", "Activity Sessions", entitySchemas.activitySessionQuerySchema, entitySchemas.activitySessionResponseSchema, ActivitySession, PUBLIC_CRUD),
  calendarEvents: decoration("calendar-events", "Calendar Events", entitySchemas.calendarEventQuerySchema, entitySchemas.calendarEventResponseSchema, CalendarEvent, PUBLIC_CRUD),
  attendance: decoration("attendance", "Attendance Records", entitySchemas.attendanceQuerySchema, entitySchemas.attendanceResponseSchema, AttendanceRecord, PUBLIC_CRUD),
  announcements: decoration("announcements", "Announcements", entitySchemas.announcementQuerySchema, entitySchemas.announcementResponseSchema, Announcement, PUBLIC_CRUD),
  announcementTargets: decoration("announcement-targets", "Announcement Targets", entitySchemas.announcementTargetQuerySchema, entitySchemas.announcementTargetResponseSchema, AnnouncementTarget, PUBLIC_CRUD),
  messageDeliveries: decoration("message-deliveries", "Message Deliveries", entitySchemas.messageDeliveryQuerySchema, entitySchemas.messageDeliveryResponseSchema, MessageDelivery, PUBLIC_CRUD),
  schoolNotificationTemplates: decoration("school-notification-templates", "School Notification Templates", entitySchemas.schoolNotificationTemplatesQuerySchema, entitySchemas.schoolNotificationTemplatesResponseSchema, SchoolNotificationTemplates, COMMAND_ONLY),
  subjects: decoration("subjects", "Subjects", entitySchemas.subjectQuerySchema, entitySchemas.subjectResponseSchema, Subject, PUBLIC_CRUD),
  subjectMatters: decoration("subject-matters", "Subject Matters", entitySchemas.subjectMatterQuerySchema, entitySchemas.subjectMatterResponseSchema, SubjectMatter, PUBLIC_CRUD),
  gradeLevelSubjects: decoration("grade-level-subjects", "Grade Level Subjects", entitySchemas.gradeLevelSubjectQuerySchema, entitySchemas.gradeLevelSubjectResponseSchema, GradeLevelSubject, COMMAND_ONLY),
  gradeLevelSubjectMatters: decoration("grade-level-subject-matters", "Grade Level Subject Matters", entitySchemas.gradeLevelSubjectMatterQuerySchema, entitySchemas.gradeLevelSubjectMatterResponseSchema, GradeLevelSubjectMatter, COMMAND_ONLY),
  classGroups: decoration("class-groups", "Class Groups", entitySchemas.classGroupQuerySchema, entitySchemas.classGroupResponseSchema, ClassGroup, PUBLIC_CRUD),
  classSubjects: decoration("class-subjects", "Class Subjects", entitySchemas.classSubjectQuerySchema, entitySchemas.classSubjectResponseSchema, ClassSubject, PUBLIC_DELETE),
  classSubjectMatters: decoration("class-subject-matters", "Class Subject Matters", entitySchemas.classSubjectMatterQuerySchema, entitySchemas.classSubjectMatterResponseSchema, ClassSubjectMatter, PUBLIC_CRUD),
  classSubjectProgress: decoration("class-subject-progress", "Class Subject Progress", entitySchemas.classSubjectProgressQuerySchema, entitySchemas.classSubjectProgressResponseSchema, ClassSubjectProgress, PUBLIC_CRUD),
  activities: decoration("activities", "Activities", entitySchemas.activityQuerySchema, entitySchemas.activityResponseSchema, Activity, PUBLIC_CRUD),
  activityEnrollments: decoration("activity-enrollments", "Activity Enrollments", entitySchemas.activityEnrollmentQuerySchema, entitySchemas.activityEnrollmentResponseSchema, ActivityEnrollment, PUBLIC_CRUD),
  classActivityEnrollments: decoration("class-activity-enrollments", "Class Activity Enrollments", entitySchemas.classActivityEnrollmentQuerySchema, entitySchemas.classActivityEnrollmentResponseSchema, ClassActivityEnrollment, PUBLIC_CRUD),
  assessments: decoration("assessments", "Assessments", entitySchemas.assessmentQuerySchema, entitySchemas.assessmentResponseSchema, Assessment, PUBLIC_CRUD),
  assessmentResults: decoration("assessment-results", "Assessment Results", entitySchemas.assessmentResultQuerySchema, entitySchemas.assessmentResultResponseSchema, AssessmentResult, COMMAND_ONLY),
  gradeScales: decoration("grade-scales", "Grade Scales", entitySchemas.gradeScaleQuerySchema, entitySchemas.gradeScaleResponseSchema, GradeScale, PUBLIC_CRUD),
  definitions: decoration("definitions", "Report Card Definitions", entitySchemas.definitionQuerySchema, entitySchemas.definitionResponseSchema, ReportCardDefinition, PUBLIC_CRUD),
  sections: decoration("sections", "Report Card Sections", entitySchemas.sectionQuerySchema, entitySchemas.sectionResponseSchema, ReportCardDefinitionSection, PUBLIC_CRUD),
  results: decoration("results", "Report Card Results", entitySchemas.resultQuerySchema, entitySchemas.resultResponseSchema, ReportCardResult, COMMAND_ONLY),
  students: decoration("students", "Students", entitySchemas.studentQuerySchema, entitySchemas.studentResponseSchema, Student, COMMAND_ONLY),
  enrollments: decoration("enrollments", "Student Enrollments", entitySchemas.enrollmentQuerySchema, entitySchemas.enrollmentResponseSchema, StudentClassEnrollment, COMMAND_ONLY),
  guardians: decoration("guardians", "Guardians", entitySchemas.guardianQuerySchema, entitySchemas.guardianResponseSchema, Guardian, PUBLIC_CRUD),
  teachers: decoration("teachers", "Teachers", entitySchemas.teacherQuerySchema, entitySchemas.teacherResponseSchema, Teacher, PUBLIC_CRUD),
  teacherAssignments: decoration("teacher-assignments", "Teacher Assignments", entitySchemas.teacherAssignmentQuerySchema, entitySchemas.teacherAssignmentResponseSchema, TeacherAssignment, PUBLIC_CRUD),
  teacherUnavailabilities: decoration("teacher-unavailabilities", "Teacher Unavailabilities", entitySchemas.teacherUnavailabilityQuerySchema, entitySchemas.teacherUnavailabilityResponseSchema, TeacherUnavailability, PUBLIC_CRUD),
  guardianLinks: decoration("guardian-links", "Guardian Student Links", entitySchemas.guardianLinkQuerySchema, entitySchemas.guardianLinkResponseSchema, GuardianStudentLink, PUBLIC_CRUD),
  studentNotes: decoration("student-notes", "Student Notes", entitySchemas.studentNoteQuerySchema, entitySchemas.studentNoteResponseSchema, StudentNote, PUBLIC_CRUD),
  studentPhotoSubmissions: decoration("student-photo-submissions", "Student Photo Submissions", entitySchemas.studentPhotoSubmissionQuerySchema, entitySchemas.studentPhotoSubmissionResponseSchema, StudentPhotoSubmission, COMMAND_ONLY),
  studentHealthProfiles: decoration("student-health-profiles", "Student Health Profiles", entitySchemas.studentHealthProfileQuerySchema, entitySchemas.studentHealthProfileResponseSchema, StudentHealthProfile, PUBLIC_CRUD),
  studentDisciplinaryActions: decoration("student-disciplinary-actions", "Student Disciplinary Actions", entitySchemas.studentDisciplinaryActionQuerySchema, entitySchemas.studentDisciplinaryActionResponseSchema, StudentDisciplinaryAction, PUBLIC_CRUD),
  disciplinaryActions: decoration("disciplinary-actions", "Disciplinary Actions", entitySchemas.disciplinaryActionQuerySchema, entitySchemas.disciplinaryActionResponseSchema, DisciplinaryAction, PUBLIC_CRUD),
  studentIncidentInvolvements: decoration("student-incident-involvements", "Student Incident Involvements", entitySchemas.studentIncidentInvolvementQuerySchema, entitySchemas.studentIncidentInvolvementResponseSchema, StudentIncidentInvolvement, PUBLIC_CRUD),
  incidents: decoration("incidents", "Incidents", entitySchemas.incidentQuerySchema, entitySchemas.incidentResponseSchema, Incident, PUBLIC_CRUD),
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
    publicOperations: entry.publicOperations,
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
  command("publish-academic-year", "publishAcademicYear", commandSchemas.publishAcademicYearCommandSchema),
  command("archive-academic-year", "archiveAcademicYear", commandSchemas.archiveAcademicYearCommandSchema),
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
  command("accept-account-invitation", "acceptAccountInvitation", commandSchemas.acceptAccountInvitationCommandSchema),
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
  command("offer-subject-to-class", "offerSubjectToClass", commandSchemas.offerSubjectToClassCommandSchema),
  command("assign-matter-to-class-subject", "assignMatterToClassSubject", commandSchemas.assignMatterToClassSubjectCommandSchema),
  command("offer-subject-to-grade-level", "offerSubjectToGradeLevel", commandSchemas.offerSubjectToGradeLevelCommandSchema),
  command("remove-subject-from-grade-level", "removeSubjectFromGradeLevel", commandSchemas.removeSubjectFromGradeLevelCommandSchema),
  command("update-grade-level-subject", "updateGradeLevelSubject", commandSchemas.updateGradeLevelSubjectCommandSchema),
  command("assign-matter-to-grade-level-subject", "assignMatterToGradeLevelSubject", commandSchemas.assignMatterToGradeLevelSubjectCommandSchema),
  command("add-custom-class-subject", "addCustomClassSubject", commandSchemas.addCustomClassSubjectCommandSchema),
  command("set-class-subject-offered", "setClassSubjectOffered", commandSchemas.setClassSubjectOfferedCommandSchema),
  command("configure-class-subject-timetable", "configureClassSubjectTimetable", commandSchemas.configureClassSubjectTimetableCommandSchema),
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
  command("render-class-logbook", "renderClassLogbook", commandSchemas.renderClassLogbookCommandSchema),
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
  command("create-profile-photo-upload", "createProfilePhotoUpload", commandSchemas.createProfilePhotoUploadCommandSchema),
  command("complete-profile-photo-upload", "completeProfilePhotoUpload", commandSchemas.completeProfilePhotoUploadCommandSchema),
  command("submit-student-photo", "submitStudentPhoto", commandSchemas.submitStudentPhotoCommandSchema),
  command("withdraw-student-photo-submission", "withdrawStudentPhotoSubmission", commandSchemas.withdrawStudentPhotoSubmissionCommandSchema),
  command("review-student-photo", "reviewStudentPhoto", commandSchemas.reviewStudentPhotoCommandSchema),
  command("publish-student-photo", "publishStudentPhoto", commandSchemas.publishStudentPhotoCommandSchema),
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
  command("materialize-deliveries", "materializeDeliveries", commandSchemas.materializeDeliveriesCommandSchema),
  command("apply-delivery-event", "applyDeliveryEvent", commandSchemas.applyDeliveryEventCommandSchema),
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
): CoreCommandConfig {
  return {
    publicName,
    methodName,
    requestSchema,
    responseSchema: commandResponseSchemas.resolveCommandResponseSchema(methodName),
  };
}
