import { Permission } from "@edaya/core";

/** The sole external read-scope vocabulary. OAuth consent admits read actions only. */
export const guardianScopeRegistry = {
  "guardian.profile:read": { permission: Permission.QUERY_GUARDIAN_SELF_READ, routes: ["/me"] },
  "students.profile:read": { permission: Permission.QUERY_STUDENT_DETAIL_READ, routes: ["/students", "/students/:studentId"] },
  "grades:read": { permission: Permission.GRADE_READ, routes: ["/students/:studentId/grades"] },
  "report-cards:read": { permission: Permission.QUERY_REPORT_CARD_DETAIL_READ, routes: ["/students/:studentId/report-cards"] },
  "attendance:read": { permission: Permission.ATTENDANCE_READ, routes: ["/students/:studentId/attendance"] },
  "payments:read": { permission: Permission.PAYMENT_READ, routes: ["/students/:studentId/fees", "/students/:studentId/payments"] },
  "enrollments:read": { permission: Permission.QUERY_ENROLLMENT_HISTORY_READ, routes: ["/students/:studentId/enrollments"] },
  "logbook:read": { permission: Permission.CLASS_LOGBOOK_READ, routes: ["/students/:studentId/logbook"] },
  "timetable:read": { permission: Permission.QUERY_TIMETABLE_READ, routes: ["/students/:studentId/timetable"] },
  "calendar:read": { permission: Permission.QUERY_CALENDAR_READ, routes: ["/students/:studentId/calendar"] },
  "communications:read": { permission: Permission.QUERY_COMMUNICATIONS_READ, routes: ["/students/:studentId/communications"] },
  "curriculum:read": { permission: Permission.QUERY_CLASS_CURRICULUM_READ, routes: ["/students/:studentId/curriculum"] },
  "school-context:read": { permission: Permission.QUERY_WORKSPACE_READ, routes: ["/school-context"] },
  "attachments:read": { permission: Permission.ATTACHMENT_READ, routes: ["/attachments/:attachmentId"] },
} as const;

export type GuardianScope = keyof typeof guardianScopeRegistry;
export const externalOAuthScopes = ["openid", "offline_access", ...Object.keys(guardianScopeRegistry)];
