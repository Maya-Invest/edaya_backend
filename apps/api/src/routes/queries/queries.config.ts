import type { z } from "@hono/zod-openapi";
import * as schemas from "../../validation/entities.schemas";

export interface EntityQueryConfig {
  name: string;
  displayName: string;
  querySchema: z.ZodTypeAny;
  responseSchema: z.ZodTypeAny;
}

export const queryableEntities: EntityQueryConfig[] = [
  {
    name: "schools",
    displayName: "Schools",
    querySchema: schemas.schoolQuerySchema,
    responseSchema: schemas.schoolResponseSchema,
  },
  {
    name: "academicYears",
    displayName: "Academic Years",
    querySchema: schemas.academicYearQuerySchema,
    responseSchema: schemas.academicYearResponseSchema,
  },
  {
    name: "academicPeriods",
    displayName: "Academic Periods",
    querySchema: schemas.academicPeriodQuerySchema,
    responseSchema: schemas.academicPeriodResponseSchema,
  },
  {
    name: "periodDefinitions",
    displayName: "Period Definitions",
    querySchema: schemas.periodDefinitionQuerySchema,
    responseSchema: schemas.periodDefinitionResponseSchema,
  },
  {
    name: "gradeLevels",
    displayName: "Grade Levels",
    querySchema: schemas.gradeLevelQuerySchema,
    responseSchema: schemas.gradeLevelResponseSchema,
  },
  {
    name: "staffMembers",
    displayName: "Staff Members",
    querySchema: schemas.staffMemberQuerySchema,
    responseSchema: schemas.staffMemberResponseSchema,
  },
  {
    name: "staffAssignments",
    displayName: "Staff Assignments",
    querySchema: schemas.staffAssignmentQuerySchema,
    responseSchema: schemas.staffAssignmentResponseSchema,
  },
  {
    name: "attachments",
    displayName: "Attachments",
    querySchema: schemas.attachmentQuerySchema,
    responseSchema: schemas.attachmentResponseSchema,
  },
  {
    name: "resources",
    displayName: "Resources",
    querySchema: schemas.resourceQuerySchema,
    responseSchema: schemas.resourceResponseSchema,
  },
  {
    name: "resourceAssignments",
    displayName: "Resource Assignments",
    querySchema: schemas.resourceAssignmentQuerySchema,
    responseSchema: schemas.resourceAssignmentResponseSchema,
  },
  {
    name: "fees",
    displayName: "Fees",
    querySchema: schemas.feeQuerySchema,
    responseSchema: schemas.feeResponseSchema,
  },
  {
    name: "studentFees",
    displayName: "Student Fees",
    querySchema: schemas.studentFeeQuerySchema,
    responseSchema: schemas.studentFeeResponseSchema,
  },
  {
    name: "payments",
    displayName: "Payments",
    querySchema: schemas.paymentQuerySchema,
    responseSchema: schemas.paymentResponseSchema,
  },
  {
    name: "schedules",
    displayName: "Schedules",
    querySchema: schemas.scheduleQuerySchema,
    responseSchema: schemas.scheduleResponseSchema,
  },
  {
    name: "sessions",
    displayName: "Sessions",
    querySchema: schemas.sessionQuerySchema,
    responseSchema: schemas.sessionResponseSchema,
  },
  {
    name: "calendarEvents",
    displayName: "Calendar Events",
    querySchema: schemas.calendarEventQuerySchema,
    responseSchema: schemas.calendarEventResponseSchema,
  },
  {
    name: "attendance",
    displayName: "Attendance Records",
    querySchema: schemas.attendanceQuerySchema,
    responseSchema: schemas.attendanceResponseSchema,
  },
  {
    name: "announcements",
    displayName: "Announcements",
    querySchema: schemas.announcementQuerySchema,
    responseSchema: schemas.announcementResponseSchema,
  },
  {
    name: "announcementTargets",
    displayName: "Announcement Targets",
    querySchema: schemas.announcementTargetQuerySchema,
    responseSchema: schemas.announcementTargetResponseSchema,
  },
  {
    name: "messageDeliveries",
    displayName: "Message Deliveries",
    querySchema: schemas.messageDeliveryQuerySchema,
    responseSchema: schemas.messageDeliveryResponseSchema,
  },
  {
    name: "subjects",
    displayName: "Subjects",
    querySchema: schemas.subjectQuerySchema,
    responseSchema: schemas.subjectResponseSchema,
  },
  {
    name: "subjectMatters",
    displayName: "Subject Matters",
    querySchema: schemas.subjectMatterQuerySchema,
    responseSchema: schemas.subjectMatterResponseSchema,
  },
  {
    name: "classGroups",
    displayName: "Class Groups",
    querySchema: schemas.classGroupQuerySchema,
    responseSchema: schemas.classGroupResponseSchema,
  },
  {
    name: "classSubjects",
    displayName: "Class Subjects",
    querySchema: schemas.classSubjectQuerySchema,
    responseSchema: schemas.classSubjectResponseSchema,
  },
  {
    name: "classSubjectMatters",
    displayName: "Class Subject Matters",
    querySchema: schemas.classSubjectMatterQuerySchema,
    responseSchema: schemas.classSubjectMatterResponseSchema,
  },
  {
    name: "classSubjectProgress",
    displayName: "Class Subject Progress",
    querySchema: schemas.classSubjectProgressQuerySchema,
    responseSchema: schemas.classSubjectProgressResponseSchema,
  },
  {
    name: "assessments",
    displayName: "Assessments",
    querySchema: schemas.assessmentQuerySchema,
    responseSchema: schemas.assessmentResponseSchema,
  },
  {
    name: "assessmentResults",
    displayName: "Assessment Results",
    querySchema: schemas.assessmentResultQuerySchema,
    responseSchema: schemas.assessmentResultResponseSchema,
  },
  {
    name: "gradeScales",
    displayName: "Grade Scales",
    querySchema: schemas.gradeScaleQuerySchema,
    responseSchema: schemas.gradeScaleResponseSchema,
  },
  {
    name: "definitions",
    displayName: "Report Card Definitions",
    querySchema: schemas.definitionQuerySchema,
    responseSchema: schemas.definitionResponseSchema,
  },
  {
    name: "sections",
    displayName: "Report Card Sections",
    querySchema: schemas.sectionQuerySchema,
    responseSchema: schemas.sectionResponseSchema,
  },
  {
    name: "results",
    displayName: "Report Card Results",
    querySchema: schemas.resultQuerySchema,
    responseSchema: schemas.resultResponseSchema,
  },
  {
    name: "students",
    displayName: "Students",
    querySchema: schemas.studentQuerySchema,
    responseSchema: schemas.studentResponseSchema,
  },
  {
    name: "enrollments",
    displayName: "Student Enrollments",
    querySchema: schemas.enrollmentQuerySchema,
    responseSchema: schemas.enrollmentResponseSchema,
  },
  {
    name: "guardians",
    displayName: "Guardians",
    querySchema: schemas.guardianQuerySchema,
    responseSchema: schemas.guardianResponseSchema,
  },
  {
    name: "guardianLinks",
    displayName: "Guardian Student Links",
    querySchema: schemas.guardianLinkQuerySchema,
    responseSchema: schemas.guardianLinkResponseSchema,
  },
  {
    name: "studentNotes",
    displayName: "Student Notes",
    querySchema: schemas.studentNoteQuerySchema,
    responseSchema: schemas.studentNoteResponseSchema,
  },
  {
    name: "studentHealthProfiles",
    displayName: "Student Health Profiles",
    querySchema: schemas.studentHealthProfileQuerySchema,
    responseSchema: schemas.studentHealthProfileResponseSchema,
  },
  {
    name: "studentDisciplinaryActions",
    displayName: "Student Disciplinary Actions",
    querySchema: schemas.studentDisciplinaryActionQuerySchema,
    responseSchema: schemas.studentDisciplinaryActionResponseSchema,
  },
  {
    name: "disciplinaryActions",
    displayName: "Disciplinary Actions",
    querySchema: schemas.disciplinaryActionQuerySchema,
    responseSchema: schemas.disciplinaryActionResponseSchema,
  },
  {
    name: "studentIncidentInvolvements",
    displayName: "Student Incident Involvements",
    querySchema: schemas.studentIncidentInvolvementQuerySchema,
    responseSchema: schemas.studentIncidentInvolvementResponseSchema,
  },
  {
    name: "incidents",
    displayName: "Incidents",
    querySchema: schemas.incidentQuerySchema,
    responseSchema: schemas.incidentResponseSchema,
  },
];
