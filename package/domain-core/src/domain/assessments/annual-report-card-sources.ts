import type { AcademicPeriod } from '../school/academic-period'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { ReportCardAggregationSource } from './report-card-aggregation-config'
import { ReportCardResult, ReportCardResultStatus } from './report-card-result'
import { ReportCardResultSection } from './report-card-result-section'

/** Deterministic academic provenance. Includes values as well as revisions to detect changed sources. */
export async function reportCardAcademicVersion(result: ReportCardResult): Promise<string> {
  const sections = (nodes: readonly ReportCardResultSection[]): unknown[] => nodes.map(node => [
    node.sectionId,
    node.classSubjectId,
    node.sectionKind,
    node.average,
    node.weight,
    node.rank,
    sections(node.subResults),
  ])
  const facts = JSON.stringify([
    result.id,
    result.version,
    result.studentId,
    result.classGroupId,
    result.periodId,
    result.reportCardDefinitionId,
    result.generatedAt.toISOString(),
    result.publishedAt?.toISOString(),
    result.overallAverage,
    result.rank,
    result.classSize,
    result.aggregation,
    result.attendanceSummary,
    [...result.sourceMarks].sort((a, b) => a.resultId.localeCompare(b.resultId)),
    [...result.sourceAssessments].sort((a, b) => a.assessmentId.localeCompare(b.assessmentId)),
    sections(result.sectionResults),
  ])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(facts))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

export function assertCurrentPublishedReport(result: ReportCardResult): void {
  if (result.status !== ReportCardResultStatus.Published)
    fail('DOCUMENT_SOURCE_UNPUBLISHED', 'Publish every contributing report before issuing the annual report card')
  if (result.calculationStale || result.pendingCorrectionIds.length || result.pendingAssessmentIds.length)
    fail('DOCUMENT_SOURCE_CHANGED', 'Resolve pending corrections and regenerate stale report grades')
}

/** Validates the complete annual dependency set for both issuance and private downloads. */
export async function assertAnnualReportCardSources(
  annual: ReportCardResult,
  annualPeriod: AcademicPeriod,
  contributors: readonly { result: ReportCardResult, period: AcademicPeriod }[],
): Promise<void> {
  assertCurrentPublishedReport(annual)
  const aggregation = annual.aggregation
  if (!aggregation || aggregation.source !== ReportCardAggregationSource.ReportCards)
    fail('DOCUMENT_SOURCE_MISSING', 'Generate an annual result from published period reports first')
  if (!annualPeriod.isPublished || contributors.some(entry => !entry.period.isPublished))
    fail('DOCUMENT_SOURCE_UNPUBLISHED', 'Publish the annual period and every contributing period first')
  const ids = aggregation.sourcePeriodIds
  if (new Set(ids).size !== ids.length || ids.includes(annual.periodId) || contributors.length !== ids.length)
    fail('DOCUMENT_INPUT_CONFLICT', 'Annual report periods must be distinct and must exclude the annual target')
  const chronological = [...contributors].sort((a, b) => a.period.startDate.getTime() - b.period.startDate.getTime())
  if (chronological.some((entry, index) => entry.period.startDate < annualPeriod.startDate || entry.period.endDate > annualPeriod.endDate
    || (index > 0 && entry.period.startDate <= chronological[index - 1]!.period.endDate))) {
    fail('DOCUMENT_INPUT_CONFLICT', 'Choose nonoverlapping grading periods within the annual target dates')
  }
  for (const id of ids) {
    const matches = contributors.filter(entry => entry.period.id === id)
    if (matches.length !== 1)
      fail('DOCUMENT_INPUT_CONFLICT', 'Choose one unambiguous published report for each contributing period')
    const { result, period } = matches[0]!
    if (result.studentId !== annual.studentId || result.periodId !== period.id
      || period.schoolId !== annualPeriod.schoolId || period.academicYearId !== annualPeriod.academicYearId) {
      fail('DOCUMENT_SOURCE_INACCESSIBLE', 'All annual report sources must belong to this student and school year')
    }
    if (result.aggregation)
      fail('DOCUMENT_INPUT_CONFLICT', 'Choose original grading periods rather than overlapping synthesis reports')
    assertCurrentPublishedReport(result)
    const version = aggregation.sourceReportVersions?.find(entry => entry.periodId === id)
    if (!version || version.resultId !== result.id || version.sourceVersion !== await reportCardAcademicVersion(result))
      fail('DOCUMENT_SOURCE_CHANGED', 'Regenerate the annual result from the current contributing reports')
  }
}

/** Preserve the published contributors of an annual report until that report is republished. */
export async function publishedReportSource(result: ReportCardResult, expectedVersion?: string): Promise<ReportCardResult> {
  if (!expectedVersion || await reportCardAcademicVersion(result) === expectedVersion)
    return result
  const hydrate = (nodes: readonly ReportCardResultSection[]): ReportCardResultSection[] => nodes.map(node => new ReportCardResultSection({ ...(node.data ?? node), subResults: hydrate(node.subResults) }))
  for (const snapshot of result.publicationHistory) {
    const historical = new ReportCardResult({ ...snapshot, sectionResults: hydrate(snapshot.sectionResults) })
    if (await reportCardAcademicVersion(historical) === expectedVersion)
      return historical
  }
  return result
}
