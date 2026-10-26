import type { DashboardActionItem, DashboardProjectionPort, DashboardScopes, GetSchoolOverviewInput, SchoolOverview, SchoolOverviewKpis } from '@edaya/core'

export type { DashboardActionItem, DashboardActionKey, DashboardAreaHealth, DashboardAreaHealthAcademics, DashboardAreaHealthFinance, DashboardAreaHealthSchoolLife, DashboardAreaHealthStudents, DashboardClassRiskLevel, DashboardClassRiskRow, DashboardUpcomingItem, DashboardUpcomingKind, GetSchoolOverviewInput, SchoolOverview, SchoolOverviewKpis } from '@edaya/core'

function buildActionItems(kpis: SchoolOverviewKpis, pendingStudentPhotoCount = 0): DashboardActionItem[] {
  const candidates: DashboardActionItem[] = []

  if (kpis.overdueFeeCount > 0) {
    candidates.push({
      key: 'overdue_fees',
      count: kpis.overdueFeeCount,
      amount: kpis.overdueFeeAmount,
    })
  }
  if (kpis.unpublishedReportCardCount !== null && kpis.unpublishedReportCardCount > 0) {
    candidates.push({
      key: 'unpublished_report_cards',
      count: kpis.unpublishedReportCardCount,
    })
  }
  if (kpis.pendingJustificationCount > 0) {
    candidates.push({
      key: 'pending_justifications',
      count: kpis.pendingJustificationCount,
    })
  }
  if (kpis.highSeverityIncidentCount > 0) {
    candidates.push({
      key: 'high_severity_incidents',
      count: kpis.highSeverityIncidentCount,
    })
  }
  if (kpis.incompleteGradingClassCount !== null && kpis.incompleteGradingClassCount > 0) {
    candidates.push({
      key: 'incomplete_grading',
      count: kpis.incompleteGradingClassCount,
    })
  }
  if (pendingStudentPhotoCount > 0) {
    candidates.push({
      key: 'pending_student_photos',
      count: pendingStudentPhotoCount,
    })
  }

  return candidates.slice(0, 5)
}

export async function buildSchoolOverview(port: DashboardProjectionPort, scopes: DashboardScopes, input: GetSchoolOverviewInput, extras: { pendingStudentPhotoCount?: number } = {}): Promise<SchoolOverview> {
  const result = await port.overview(input, scopes)
  return { ...result, actionItems: buildActionItems(result.kpis, extras.pendingStudentPhotoCount ?? 0) }
}
