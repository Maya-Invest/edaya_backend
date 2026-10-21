import { gradingPolicySchema } from "@edaya/core";
import { z } from "@hono/zod-openapi";
import { assessmentResponseSchema, assessmentResultResponseSchema, classSubjectResponseSchema, subjectResponseSchema } from "./entities";
import { marksCorrectionResponseSchema } from "./marks-corrections";

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
  teacherCount: z.number().int().nonnegative(),
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
  timetableTeacherIds: z.array(z.string().min(1)).optional(),
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

export const getTeacherTimetableQuerySchema = z.object({
  teacherId: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
}).openapi("GetTeacherTimetableQuery");

export const teacherTimetableResponseSchema = z.object({
  teacherId: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
  events: z.array(timetableEventSchema),
}).openapi("TeacherTimetableResponse");

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

export const familyFeedbackLocaleQuerySchema = z.enum(["fr", "en"]);

export const familyFeedbackCampaignProjectionQueryResponseSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  academicYearId: z.string().min(1),
  academicPeriodId: z.string().min(1),
  classGroupId: z.string().min(1),
  classSubjectId: z.string().min(1),
  teacherAssignmentId: z.string().min(1),
  teacherId: z.string().min(1),
  subjectId: z.string().min(1),
  questionVersion: z.string().min(1),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  openedAt: z.string().optional(),
  closedAt: z.string().optional(),
  cancelledAt: z.string().optional(),
  publishedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  answersPurgedAt: z.string().optional(),
  moderatorStaffId: z.string().optional(),
  themeDraft: z.string().optional(),
}).openapi("FamilyFeedbackCampaignProjection");
export const familyFeedbackCampaignProjectionListQueryResponseSchema = z
  .array(familyFeedbackCampaignProjectionQueryResponseSchema)
  .openapi("FamilyFeedbackCampaignProjectionList");

export const listFamilyFeedbackCampaignsQuerySchema = z.object({}).openapi("ListFamilyFeedbackCampaignsQuery");
export const getFamilyFeedbackCampaignQuerySchema = z.object({ id: z.string().min(1) }).openapi("GetFamilyFeedbackCampaignQuery");
export const previewFamilyFeedbackAudienceQuerySchema = z.object({
  id: z.string().min(1).optional(),
  academicYearId: z.string().min(1),
  academicPeriodId: z.string().min(1),
  teacherAssignmentId: z.string().min(1),
}).openapi("PreviewFamilyFeedbackAudienceQuery");
export const familyFeedbackAudiencePreviewResponseSchema = z.object({
  campaignId: z.string(),
  eligibleCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  blockers: z.array(z.string()),
}).openapi("FamilyFeedbackAudiencePreview");
export const getFamilyFeedbackInstrumentQuerySchema = z.object({
  locale: familyFeedbackLocaleQuerySchema,
}).openapi("GetFamilyFeedbackInstrumentQuery");
export const familyFeedbackInstrumentResponseSchema = z.object({
  version: z.string().min(1),
  intro: z.string().min(1),
  confidentialityNotice: z.string().min(1),
  scaleHelper: z.string().min(1),
  scaleLabels: z.record(z.string(), z.string()),
  commentPrompt: z.string().min(1),
  items: z.array(z.object({ id: z.string().min(1), stem: z.string().min(1) })),
}).openapi("FamilyFeedbackInstrument");
export const listGuardianFamilyFeedbackCampaignsQuerySchema = z.object({}).openapi("ListGuardianFamilyFeedbackCampaignsQuery");
export const familyFeedbackContextSchema = z.object({
  studentName: z.string().min(1),
  teacherName: z.string().min(1),
  subjectName: z.string().min(1),
  className: z.string().min(1),
  periodName: z.string().min(1),
}).openapi("FamilyFeedbackContext");
export const guardianFamilyFeedbackCampaignListResponseSchema = z.array(z.object({
  campaignId: z.string().min(1),
  studentId: z.string().min(1),
  slotState: z.string().min(1),
  closesAt: z.string().optional(),
  context: familyFeedbackContextSchema,
})).openapi("GuardianFamilyFeedbackCampaignList");
export const getGuardianFamilyFeedbackQuestionnaireQuerySchema = z.object({
  campaignId: z.string().min(1),
  studentId: z.string().min(1),
  locale: familyFeedbackLocaleQuerySchema,
}).openapi("GetGuardianFamilyFeedbackQuestionnaireQuery");
export const guardianFamilyFeedbackQuestionnaireResponseSchema = z.object({
  campaignId: z.string().min(1),
  studentId: z.string().min(1),
  slotId: z.string().min(1),
  slotState: z.string().min(1),
  closesAt: z.string().optional(),
  context: familyFeedbackContextSchema,
  instrument: familyFeedbackInstrumentResponseSchema.optional(),
  receipt: z.object({
    status: z.literal("completed"),
    completedAt: z.string().optional(),
  }).optional(),
}).openapi("GuardianFamilyFeedbackQuestionnaire");
export const listFamilyFeedbackCommentsQuerySchema = z.object({ id: z.string().min(1) }).openapi("ListFamilyFeedbackCommentsQuery");
export const familyFeedbackCommentsResponseSchema = z.object({
  comments: z.array(z.object({ id: z.string().min(1), comment: z.string().min(1) })),
}).openapi("FamilyFeedbackComments");
export const getFamilyFeedbackAggregateReviewQuerySchema = z.object({ id: z.string().min(1) }).openapi("GetFamilyFeedbackAggregateReviewQuery");
export const familyFeedbackAggregateResponseSchema = z.object({
  campaignId: z.string().min(1),
  status: z.string().min(1),
  eligibleSlotCount: z.number().int().nonnegative(),
  completedSlotCount: z.number().int().nonnegative(),
  responseRate: z.number(),
  overallSuppressed: z.boolean(),
  questions: z.array(z.object({
    questionId: z.string().min(1),
    suppressed: z.boolean(),
    nScored: z.number().int().nonnegative(),
    nCannotAssess: z.number().int().nonnegative(),
    distribution: z.object({
      1: z.number().int().nonnegative(),
      2: z.number().int().nonnegative(),
      3: z.number().int().nonnegative(),
      4: z.number().int().nonnegative(),
      5: z.number().int().nonnegative(),
    }),
  })),
  themes: z.string().optional(),
}).openapi("FamilyFeedbackAggregate");
export const listTeacherFamilyFeedbackResultsQuerySchema = z.object({}).openapi("ListTeacherFamilyFeedbackResultsQuery");
export const getTeacherFamilyFeedbackResultQuerySchema = z.object({ id: z.string().min(1) }).openapi("GetTeacherFamilyFeedbackResultQuery");
export const teacherFamilyFeedbackResultResponseSchema = familyFeedbackAggregateResponseSchema.omit({ status: true }).openapi("TeacherFamilyFeedbackResult");
export const teacherFamilyFeedbackResultListResponseSchema = z.array(teacherFamilyFeedbackResultResponseSchema).openapi("TeacherFamilyFeedbackResultList");

export const getAssessmentMarksReviewQuerySchema = z.object({ assessmentId: z.string().min(1) }).openapi("GetAssessmentMarksReviewQuery");
export const listAssessmentMarksReviewsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
  classGroupId: z.string().min(1).optional(),
  periodId: z.string().min(1).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).openapi("ListAssessmentMarksReviewsQuery");
export const assessmentMarksReviewResponseSchema = z.object({
  gradingPolicy: gradingPolicySchema.optional(),
  assessment: assessmentResponseSchema,
  students: z.array(z.object({ id: z.string(), firstName: z.string(), lastName: z.string() })),
  results: z.array(assessmentResultResponseSchema),
  missingStudentIds: z.array(z.string()),
  publishedResultIds: z.array(z.string()),
  corrections: z.array(marksCorrectionResponseSchema.extend({ allowedActions: z.object({ approve: z.boolean(), reject: z.boolean(), withdraw: z.boolean() }) })),
  allowedActions: z.object({ submit: z.boolean(), requestCorrection: z.boolean() }),
}).openapi("AssessmentMarksReviewResponse");
export const assessmentMarksReviewsResponseSchema = z.object({
  items: z.array(z.object({
    correction: marksCorrectionResponseSchema,
    assessment: assessmentResponseSchema,
    allowedActions: z.object({ approve: z.boolean(), reject: z.boolean(), withdraw: z.boolean() }),
  })),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
}).openapi("AssessmentMarksReviewsResponse");

export const getAssessmentEditorContextQuerySchema = z.object({ classGroupId: z.string().min(1), periodId: z.string().min(1) }).openapi("GetAssessmentEditorContextQuery");
export const assessmentEditorContextResponseSchema = z.object({ assessmentsRaw: z.array(assessmentResponseSchema), classSubjectsRaw: z.array(classSubjectResponseSchema), subjectsRaw: z.array(subjectResponseSchema), classSize: z.number().int().nonnegative(), markResults: z.array(z.object({ assessmentId: z.string(), results: z.array(assessmentResultResponseSchema) })) }).openapi("AssessmentEditorContextResponse");

export const getActivityRosterQuerySchema = z.object({ activityId: z.string().min(1) }).openapi("GetActivityRosterQuery");
export const activityRosterResponseSchema = z.object({
  students: z.array(z.object({ id: z.string(), firstName: z.string(), lastName: z.string(), matricule: z.string().optional(), classGroupId: z.string().optional() })),
  eligibleStudentIds: z.array(z.string()),
  classes: z.array(z.object({ id: z.string(), name: z.string() })),
}).openapi("ActivityRosterResponse");

const financeScopeSchema = z.object({ schoolId: z.string().min(1), academicYearId: z.string().min(1) });
export const getFinanceOverviewQuerySchema = financeScopeSchema.openapi("GetFinanceOverviewQuery");
export const getFeeFinanceOverviewQuerySchema = financeScopeSchema.extend({ feeId: z.string().min(1) }).openapi("GetFeeFinanceOverviewQuery");
export const getFinanceBillingDetailQuerySchema = financeScopeSchema.extend({ chargeId: z.string().min(1) }).openapi("GetFinanceBillingDetailQuery");
const financePageQuerySchema = financeScopeSchema.extend({
  dueFrom: z.string().date().optional(),
  dueTo: z.string().date().optional(),
  paymentId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  feeId: z.string().min(1).optional(),
  search: z.string().max(200).optional(),
  classGroupId: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  due: z.enum(["overdue", "outstanding"]).optional(),
  sort: z.enum(["student", "label", "net", "applied", "remaining", "dueDate", "status", "paymentDate", "amount"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
});
export const getFinanceBillingPageQuerySchema = financePageQuerySchema.openapi("GetFinanceBillingPageQuery");
export const getFinancePaymentsPageQuerySchema = financePageQuerySchema.openapi("GetFinancePaymentsPageQuery");
export const financeOverviewResponseSchema = financeScopeSchema.extend({
  currency: z.string(),
  scope: z.literal("authorized"),
  received: z.number().int(),
  refunded: z.number().int(),
  netCollected: z.number().int(),
  outstanding: z.number().int(),
  overdue: z.number().int(),
  overdueStudents: z.number().int(),
  availableCredit: z.number().int(),
  studentsAssigned: z.number().int(),
  netBilled: z.number().int(),
  applied: z.number().int(),
}).openapi("FinanceOverviewResponse");
const financeBillingRowSchema = z.object({
  classId: z.string().nullable(),
  id: z.string(),
  schoolId: z.string(),
  academicYearId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  enrollmentId: z.string(),
  catalogServiceId: z.string(),
  label: z.string(),
  currency: z.string(),
  status: z.string(),
  createdAt: z.string(),
  expectedAmount: z.number().int(),
  adjustmentAmount: z.number().int(),
  waiverAmount: z.number().int(),
  allocatedAmount: z.number().int(),
  netAmount: z.number().int(),
  remaining: z.number().int(),
  overdue: z.number().int(),
  availableCredit: z.number().int(),
  dueDate: z.string().nullable(),
  adjustmentReason: z.string().nullable(),
  adjustedAt: z.string().nullable(),
  adjustedById: z.string().nullable(),
  waiverReason: z.string().nullable(),
  waivedAt: z.string().nullable(),
  waivedById: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelledById: z.string().nullable(),
  accountId: z.string().nullable(),
  installments: z.array(z.object({ id: z.string(), label: z.string(), expectedAmount: z.number().int(), dueDate: z.string().nullable().optional() })),
}).openapi("FinanceBillingRow");
export const financeBillingDetailResponseSchema = financeBillingRowSchema.nullable().openapi("FinanceBillingDetailResponse");
export const financeBillingPageResponseSchema = z.object({ rows: z.array(financeBillingRowSchema), total: z.number().int().nonnegative() }).openapi("FinanceBillingPageResponse");
const financePaymentRowSchema = z.object({
  classId: z.string().nullable(),
  hasActiveAllocations: z.boolean(),
  id: z.string(),
  schoolId: z.string(),
  academicYearId: z.string(),
  accountId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  kind: z.string(),
  currency: z.string(),
  paymentDate: z.string(),
  method: z.string(),
  status: z.string(),
  createdAt: z.string(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  recordedById: z.string().nullable(),
  reversedAt: z.string().nullable(),
  reversedById: z.string().nullable(),
  reversesPaymentId: z.string().nullable(),
  reversedByPaymentId: z.string().nullable(),
  amount: z.number().int(),
}).openapi("FinancePaymentRow");
export const financePaymentsPageResponseSchema = z.object({ rows: z.array(financePaymentRowSchema), total: z.number().int().nonnegative() }).openapi("FinancePaymentsPageResponse");
