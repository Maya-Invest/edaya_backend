import { z } from "@hono/zod-openapi";

export const getSchoolOverviewQuerySchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  academicPeriodId: z.string().min(1),
  referenceDate: z.string().date().optional(),
}).openapi("GetSchoolOverviewQuery");

export const getAppShellCountsQuerySchema = z.object({
  schoolId: z.string().min(1),
  classGroupIds: z.array(z.string().min(1)).optional(),
}).openapi("GetAppShellCountsQuery");

export const appShellCountsResponseSchema = z.object({
  schoolId: z.string().min(1),
  activeEnrollmentCountsByClass: z.record(z.string(), z.number().int().nonnegative()),
  studentCount: z.number().int().nonnegative(),
  guardianCount: z.number().int().nonnegative(),
  staffCount: z.number().int().nonnegative(),
}).openapi("AppShellCountsResponse");

export const dashboardActionItemSchema = z.object({
  key: z.enum([
    "overdue_fees",
    "unpublished_report_cards",
    "pending_justifications",
    "high_severity_incidents",
    "incomplete_grading",
  ]),
  count: z.number().int().nonnegative(),
  amount: z.number().int().nonnegative().optional(),
}).openapi("DashboardActionItem");

export const dashboardUpcomingItemSchema = z.object({
  id: z.string().min(1),
  date: z.string().date(),
  title: z.string().min(1),
  kind: z.enum(["calendar", "fee_due", "report_card_deadline", "exam", "holiday"]),
  highlight: z.boolean(),
}).openapi("DashboardUpcomingItem");

export const dashboardClassRiskRowSchema = z.object({
  classGroupId: z.string().min(1),
  className: z.string().min(1),
  coordinatorName: z.string().nullable(),
  attendanceRateToday: z.number().nullable(),
  openIncidentCount: z.number().int().nonnegative(),
  gradingCompletionPercent: z.number().nullable(),
  overdueFeeCount: z.number().int().nonnegative(),
  riskLevel: z.enum(["normal", "watch", "needs_action"]),
}).openapi("DashboardClassRiskRow");

export const dashboardAreaHealthStudentsSchema = z.object({
  attendanceRateToday: z.number().nullable(),
  absencesToday: z.number().int().nonnegative(),
  pendingJustifications: z.number().int().nonnegative(),
}).openapi("DashboardAreaHealthStudents");

export const dashboardAreaHealthAcademicsSchema = z.object({
  gradingCompletionPercent: z.number().nullable(),
  publishedReportCards: z.number().int().nonnegative(),
  totalReportCards: z.number().int().nonnegative(),
  incompleteGradingClassCount: z.number().int().nonnegative(),
}).openapi("DashboardAreaHealthAcademics");

export const dashboardAreaHealthFinanceSchema = z.object({
  overdueAmount: z.number().int().nonnegative(),
  studentsWithBalance: z.number().int().nonnegative(),
  recentPaymentCount: z.number().int().nonnegative(),
  recentPaymentAmount: z.number().int().nonnegative(),
}).openapi("DashboardAreaHealthFinance");

export const dashboardAreaHealthSchoolLifeSchema = z.object({
  openIncidentCount: z.number().int().nonnegative(),
  highSeverityIncidentCount: z.number().int().nonnegative(),
  activeActivityCount: z.number().int().nonnegative(),
  unresolvedDisciplineCount: z.number().int().nonnegative(),
}).openapi("DashboardAreaHealthSchoolLife");

export const dashboardAreaHealthSchema = z.object({
  students: dashboardAreaHealthStudentsSchema,
  academics: dashboardAreaHealthAcademicsSchema,
  finance: dashboardAreaHealthFinanceSchema,
  schoolLife: dashboardAreaHealthSchoolLifeSchema,
}).openapi("DashboardAreaHealth");

export const schoolOverviewKpisSchema = z.object({
  studentCount: z.number().int().nonnegative(),
  staffCount: z.number().int().nonnegative(),
  overdueFeeCount: z.number().int().nonnegative(),
  overdueFeeAmount: z.number().int().nonnegative(),
  publishedReportCardCount: z.number().int().nonnegative(),
  unpublishedReportCardCount: z.number().int().nonnegative(),
  attendanceRateToday: z.number().nullable(),
  absencesToday: z.number().int().nonnegative(),
  openIncidentCount: z.number().int().nonnegative(),
  highSeverityIncidentCount: z.number().int().nonnegative(),
  pendingJustificationCount: z.number().int().nonnegative(),
  incompleteGradingClassCount: z.number().int().nonnegative(),
}).openapi("SchoolOverviewKpis");

export const timetableEventSchema = z.object({
  kind: z.enum(["lesson", "activity", "assessment"]),
  id: z.string().min(1),
  classGroupId: z.string().min(1),
  classSubjectId: z.string().min(1).optional(),
  activityId: z.string().min(1).optional(),
  title: z.string().min(1),
  subjectLabel: z.string().min(1).optional(),
  teacherName: z.string().min(1).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  lessonSessionId: z.string().min(1).optional(),
  activitySessionId: z.string().min(1).optional(),
  assessmentId: z.string().min(1).optional(),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
}).openapi("TimetableEvent");

export const getClassGroupTimetableQuerySchema = z.object({
  classGroupId: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
}).openapi("GetClassGroupTimetableQuery");

export const classGroupTimetableResponseSchema = z.object({
  classGroupId: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
  events: z.array(timetableEventSchema),
}).openapi("ClassGroupTimetableResponse");

export const resolveTimetableSpaceQuerySchema = z.object({
  classGroupId: z.string().min(1),
  academicYearId: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
}).openapi("ResolveTimetableSpaceQuery");

export const resolvedTimetableCellSchema = z.object({
  date: z.string().date(),
  weekKey: z.string().date(),
  weeklyIndex: z.number().int().nonnegative(),
  periodDefinitionId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
}).openapi("ResolvedTimetableCell");

export const resolvedTimetableSpaceResponseSchema = z.array(resolvedTimetableCellSchema)
  .openapi("ResolvedTimetableSpaceResponse");

export const schoolOverviewResponseSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  academicPeriodId: z.string().min(1),
  referenceDate: z.string().date(),
  generatedAt: z.string().datetime(),
  kpis: schoolOverviewKpisSchema,
  actionItems: z.array(dashboardActionItemSchema),
  upcoming: z.array(dashboardUpcomingItemSchema),
  areaHealth: dashboardAreaHealthSchema,
  classRiskRows: z.array(dashboardClassRiskRowSchema),
}).openapi("SchoolOverviewResponse");
