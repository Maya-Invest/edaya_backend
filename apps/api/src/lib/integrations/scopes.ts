import { GuardianCapability } from "@edaya/authorization";

/** The sole external read-scope vocabulary. No mutation capability is delegable. */
export const guardianScopeRegistry = {
  "guardian.profile:read": { capability: GuardianCapability.ReadSelfProfile, routes: ["/me"] },
  "students.profile:read": { capability: GuardianCapability.ReadStudentDetail, routes: ["/students", "/students/:studentId"] },
  "grades:read": { capability: GuardianCapability.ReadGrades, routes: ["/students/:studentId/grades"] },
  "report-cards:read": { capability: GuardianCapability.ReadReportCard, routes: ["/students/:studentId/report-cards"] },
  "attendance:read": { capability: GuardianCapability.ReadAttendance, routes: ["/students/:studentId/attendance"] },
  "payments:read": { capability: GuardianCapability.ReadPayments, routes: ["/students/:studentId/fees", "/students/:studentId/payments"] },
  "enrollments:read": { capability: GuardianCapability.ReadEnrollmentHistory, routes: ["/students/:studentId/enrollments"] },
  "logbook:read": { capability: GuardianCapability.ReadLogbook, routes: ["/students/:studentId/logbook"] },
  "timetable:read": { capability: GuardianCapability.ReadTimetable, routes: ["/students/:studentId/timetable"] },
  "calendar:read": { capability: GuardianCapability.ReadCalendar, routes: ["/students/:studentId/calendar"] },
  "communications:read": { capability: GuardianCapability.ReadCommunications, routes: ["/students/:studentId/communications"] },
  "curriculum:read": { capability: GuardianCapability.ReadCurriculum, routes: ["/students/:studentId/curriculum"] },
  "school-context:read": { capability: GuardianCapability.ReadWorkspaceShell, routes: ["/school-context"] },
  "attachments:read": { capability: GuardianCapability.ReadAttachments, routes: ["/attachments/:attachmentId"] },
} as const;

export type GuardianScope = keyof typeof guardianScopeRegistry;
export const externalOAuthScopes = ["openid", "offline_access", ...Object.keys(guardianScopeRegistry)];
