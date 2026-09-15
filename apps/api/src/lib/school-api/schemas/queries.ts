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
    "pending_student_photos",
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

const moneyAmountSchema = z.object({
  amount: z.number().int(),
  currency: z.string().min(1),
});

export const getStudentFinanceSummaryQuerySchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
}).openapi("GetStudentFinanceSummaryQuery");

export const studentFinanceSummaryResponseSchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  accountId: z.string().min(1).optional(),
  currency: z.string().min(1),
  available: moneyAmountSchema,
  outstanding: moneyAmountSchema,
  overdue: moneyAmountSchema,
}).openapi("StudentFinanceSummaryResponse");

export const getAccountStatementQuerySchema = z.object({
  accountId: z.string().min(1),
}).openapi("GetAccountStatementQuery");

export const accountStatementResponseSchema = z.object({
  accountId: z.string().min(1),
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  currency: z.string().min(1),
  projectedAvailable: z.number().int().nonnegative(),
  entrySum: z.number().int(),
  entries: z.array(z.object({
    id: z.string().min(1),
    direction: z.string().min(1),
    amount: z.number().int(),
    sourceKind: z.string().min(1),
    sourceId: z.string().min(1),
    effectiveAt: z.string(),
    recordedAt: z.string(),
    resultingAvailableBalance: z.number().int().nonnegative(),
  })),
  payments: z.array(z.object({
    id: z.string().min(1),
    kind: z.string().min(1),
    amount: z.number().int(),
    status: z.string().min(1),
    paymentDate: z.string(),
    method: z.string().min(1),
    reference: z.string().optional(),
  })),
  allocations: z.array(z.object({
    id: z.string().min(1),
    chargeId: z.string().min(1),
    amount: z.number().int(),
    kind: z.string().min(1),
  })),
  charges: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    remainingObligation: z.number().int().nonnegative(),
    status: z.string().min(1),
  })),
}).openapi("AccountStatementResponse");

export const getSchoolFinanceAgingQuerySchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
}).openapi("GetSchoolFinanceAgingQuery");

export const schoolFinanceAgingResponseSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
  currency: z.string().min(1),
  overdueCount: z.number().int().nonnegative(),
  overdueAmount: z.number().int().nonnegative(),
  outstandingAmount: z.number().int().nonnegative(),
  charges: z.array(z.object({
    chargeId: z.string().min(1),
    studentId: z.string().min(1),
    label: z.string().min(1),
    overdueAmount: z.number().int().nonnegative(),
    remainingAmount: z.number().int().nonnegative(),
    dueDate: z.string().optional(),
  })),
}).openapi("SchoolFinanceAgingResponse");

export const getFinanceReconciliationQuerySchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
}).openapi("GetFinanceReconciliationQuery");

export const financeReconciliationResponseSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
  balanced: z.boolean(),
  accounts: z.array(z.object({
    accountId: z.string().min(1),
    studentId: z.string().min(1),
    projectedAvailable: z.number().int(),
    entrySum: z.number().int(),
    difference: z.number().int(),
  })),
  charges: z.array(z.object({
    chargeId: z.string().min(1),
    studentId: z.string().min(1),
    projectedAllocated: z.number().int(),
    settlement: z.number().int(),
    difference: z.number().int(),
  })),
}).openapi("FinanceReconciliationResponse");

export const previewAccountAllocationQuerySchema = z.object({
  accountId: z.string().min(1),
  allocation: z.object({
    mode: z.enum(["account_only", "fifo", "targeted"]),
    targets: z.array(z.object({
      chargeId: z.string().min(1),
      amount: z.number().positive(),
    })).optional(),
  }),
}).openapi("PreviewAccountAllocationQuery");

export const allocationPreviewQueryResponseSchema = z.object({
  accountId: z.string().min(1),
  availableBefore: z.number().int().nonnegative(),
  availableAfter: z.number().int().nonnegative(),
  allocations: z.array(z.object({
    chargeId: z.string().min(1),
    amount: z.number().positive(),
    label: z.string().min(1),
  })),
}).openapi("AllocationPreviewQueryResponse");

export const getRelatedFamilyFinanceOverviewQuerySchema = z.object({
  academicYearId: z.string().min(1),
}).openapi("GetRelatedFamilyFinanceOverviewQuery");

export const relatedFamilyFinanceOverviewResponseSchema = z.object({
  academicYearId: z.string().min(1),
  students: z.array(studentFinanceSummaryResponseSchema),
}).openapi("RelatedFamilyFinanceOverviewResponse");

export const getStudentAccountStatementQuerySchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  currency: z.string().min(1).optional(),
}).openapi("GetStudentAccountStatementQuery");

export const studentAccountStatementResponseSchema = accountStatementResponseSchema.nullable().openapi("StudentAccountStatementResponse");

export const listOpenDueChargesQuerySchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
}).openapi("ListOpenDueChargesQuery");

export const openDueChargesResponseSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1).optional(),
  charges: z.array(z.object({
    chargeId: z.string().min(1),
    studentId: z.string().min(1),
    label: z.string().min(1),
    remainingAmount: z.number().int().nonnegative(),
    overdueAmount: z.number().int().nonnegative(),
    dueDate: z.string().optional(),
    status: z.string().min(1),
  })),
}).openapi("OpenDueChargesResponse");

export const getPaymentSettlementHistoryQuerySchema = z.object({
  accountId: z.string().min(1),
}).openapi("GetPaymentSettlementHistoryQuery");

export const paymentSettlementHistoryResponseSchema = z.object({
  accountId: z.string().min(1),
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  currency: z.string().min(1),
  payments: z.array(z.object({
    id: z.string().min(1),
    kind: z.string().min(1),
    amount: z.number().int(),
    status: z.string().min(1),
    paymentDate: z.string(),
    method: z.string().min(1),
    reference: z.string().optional(),
    reversesPaymentId: z.string().optional(),
    reversedByPaymentId: z.string().optional(),
  })),
  allocations: z.array(z.object({
    id: z.string().min(1),
    chargeId: z.string().min(1),
    amount: z.number().int(),
    kind: z.string().min(1),
    causedByPaymentId: z.string().optional(),
    reversesAllocationId: z.string().optional(),
    recordedAt: z.string(),
  })),
}).openapi("PaymentSettlementHistoryResponse");

export const reconcileStudentYearAccountQuerySchema = z.object({
  accountId: z.string().min(1),
}).openapi("ReconcileStudentYearAccountQuery");

export const studentYearAccountReconciliationResponseSchema = z.object({
  accountId: z.string().min(1),
  studentId: z.string().min(1),
  projectedAvailable: z.number().int(),
  entrySum: z.number().int(),
  difference: z.number().int(),
  balanced: z.boolean(),
  charges: z.array(z.object({
    chargeId: z.string().min(1),
    projectedAllocated: z.number().int(),
    settlement: z.number().int(),
    difference: z.number().int(),
  })),
}).openapi("StudentYearAccountReconciliationResponse");

export const listDocumentTemplatesQuerySchema = z.object({}).openapi("ListDocumentTemplatesQuery");

export const documentTemplateCatalogEntryResponseSchema = z.object({
  templateKey: z.string().min(1),
  templateVersion: z.string().min(1),
  locales: z.array(z.enum(["fr", "en"])),
  format: z.literal("pdf"),
  sourceType: z.string().min(1),
  numberingKind: z.string().nullable(),
  familyDownload: z.boolean(),
  teacherOperational: z.boolean(),
  titles: z.object({
    fr: z.string().min(1),
    en: z.string().min(1),
  }),
}).openapi("DocumentTemplateCatalogEntry");

export const documentTemplateCatalogResponseSchema = z.array(documentTemplateCatalogEntryResponseSchema).openapi("DocumentTemplateCatalogResponse");

export const documentIssuanceProjectionQueryResponseSchema = z.object({
  id: z.string().min(1),
  templateKey: z.string().min(1),
  templateVersion: z.string().min(1),
  title: z.string().min(1),
  locale: z.enum(["fr", "en"]),
  academicYearId: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  sourceVersion: z.string().min(1),
  studentId: z.string().min(1).optional(),
  classGroupId: z.string().min(1).optional(),
  number: z.string().min(1).optional(),
  status: z.string().min(1),
  artifactAttachmentId: z.string().min(1).optional(),
  failureCode: z.string().min(1).optional(),
  replacesIssuanceId: z.string().min(1).optional(),
  replacedByIssuanceId: z.string().min(1).optional(),
  voidedAt: z.string().datetime().optional(),
  voidReason: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  familyDownload: z.boolean(),
}).openapi("DocumentIssuanceProjection");

export const listDocumentIssuancesQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
  classGroupId: z.string().min(1).optional(),
  templateKey: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
}).openapi("ListDocumentIssuancesQuery");

export const documentIssuanceListResponseSchema = z.array(documentIssuanceProjectionQueryResponseSchema).openapi("DocumentIssuanceListResponse");

export const getDocumentIssuanceQuerySchema = z.object({
  id: z.string().min(1),
}).openapi("GetDocumentIssuanceQuery");

export const grantDocumentDownloadQuerySchema = z.object({
  id: z.string().min(1),
}).openapi("GrantDocumentDownloadQuery");

export const documentDownloadGrantResponseSchema = z.object({
  downloadUrl: z.string().min(1),
  expiresAt: z.string().datetime(),
  fileName: z.string().min(1),
  issuanceId: z.string().min(1),
}).openapi("DocumentDownloadGrantResponse");

export const grantDocumentBundleDownloadQuerySchema = z.object({
  issuanceIds: z.array(z.string().min(1)).min(1).max(50),
}).openapi("GrantDocumentBundleDownloadQuery");

export const documentDownloadBundleResponseSchema = z.object({
  items: z.array(documentDownloadGrantResponseSchema),
}).openapi("DocumentDownloadBundleResponse");
