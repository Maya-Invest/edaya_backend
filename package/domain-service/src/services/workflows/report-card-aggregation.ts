import type { AcademicPeriod, Assessment, AssessmentResult, GradingPolicy, ReportCardAggregation, ReportCardResult, ReportCardResultSection } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import {
  BusinessRuleViolationError,
  calculateGrade,
  ReportCardAggregationSource,
  ReportCardResultStatus,
  weightForPeriod,
} from '@edaya/core'
import { hydrateReportRevision } from '../../capabilities/academics/report-comment-revisions'

type AggregationRepositories = Pick<SchoolRepositories, 'academicPeriods' | 'assessments' | 'assessmentResults' | 'results'>

export interface AggregationPublishReadiness {
  canPublish: boolean
  unpublishedPeriodIds: string[]
  missingOrDraftReportCardPeriodIds: string[]
}

export async function listPublishedPeriodIds(
  repositories: AggregationRepositories,
  periodIds: readonly string[],
): Promise<Set<string>> {
  const published = new Set<string>()
  const periods = await repositories.academicPeriods.findByIds(periodIds)
  for (const period of periods) {
    if (period.isPublished)
      published.add(period.id)
  }
  return published
}

export async function listAssessmentResultsForStudentAndPeriods(
  repositories: AggregationRepositories,
  studentId: string,
  periodIds: readonly string[],
  options: { onlyPublishedPeriods?: boolean } = {},
): Promise<Array<{ result: AssessmentResult, assessment: Assessment }>> {
  const eligiblePeriodIds = options.onlyPublishedPeriods
    ? await listPublishedPeriodIds(repositories, periodIds)
    : new Set(periodIds)
  const assessments = await repositories.assessments.list({ periodId: { $in: [...eligiblePeriodIds] }, marksStatus: 'submitted' })
  const byId = new Map(assessments.map(assessment => [assessment.id, assessment]))
  const results = assessments.length ? await repositories.assessmentResults.list({ studentId, assessmentId: { $in: [...byId.keys()] } }) : []
  const resolved = results.map(result => ({ result, assessment: byId.get(result.assessmentId)! }))
  return resolved
}

export function buildSubjectAverageFromAssessments(
  classSubjectId: string | readonly string[],
  assessmentsWithResults: Array<{ result: AssessmentResult, assessment: Assessment }>,
  policy?: GradingPolicy,
): number | undefined {
  const leafResults = assessmentsWithResults
    .filter(({ assessment, result }) => (typeof classSubjectId === 'string' ? assessment.classSubjectId === classSubjectId : classSubjectId.includes(assessment.classSubjectId)) && assessment.marksStatus === 'submitted' && result.designation !== 'absent' && result.designation !== 'exempt' && (result.score !== undefined || result.originalEntry !== undefined))
  if (leafResults.length === 0) {
    return undefined
  }
  const totalWeight = leafResults.reduce((sum, { assessment }) => sum + assessment.coefficient, 0)
  const weightedPoints = leafResults.reduce((sum, { result, assessment }) => {
    const normalizedScore = policy
      ? calculateGrade(result.originalEntry ?? { kind: 'numeric', value: result.score!, maximum: assessment.maxScore }, policy).value
      : ((result.score ?? 0) / assessment.maxScore) * 20
    return sum + normalizedScore * assessment.coefficient
  }, 0)
  return totalWeight === 0 ? undefined : weightedPoints / totalWeight
}

export interface PriorReportCardLoadResult {
  publishedByPeriodId: Map<string, ReportCardResult>
  missingOrDraftPeriodIds: string[]
}

export async function loadPriorReportCardResults(
  repositories: AggregationRepositories,
  {
    studentId,
    sourcePeriodIds,
  }: {
    studentId: string
    sourcePeriodIds: readonly string[]
  },
): Promise<PriorReportCardLoadResult> {
  const publishedByPeriodId = new Map<string, ReportCardResult>()
  const missingOrDraftPeriodIds: string[] = []
  const reports = sourcePeriodIds.length ? await repositories.results.list({ studentId, periodId: { $in: [...sourcePeriodIds] }, status: ReportCardResultStatus.Published }) : []
  for (const report of reports) {
    if (publishedByPeriodId.has(report.periodId))
      throw new BusinessRuleViolationError('AGGREGATED_REPORT_CARD_SOURCES_AMBIGUOUS', 'Each period must have one published report for this student')
    publishedByPeriodId.set(report.periodId, report)
  }
  for (const periodId of sourcePeriodIds) {
    if (!publishedByPeriodId.has(periodId))
      missingOrDraftPeriodIds.push(periodId)
  }
  return { publishedByPeriodId, missingOrDraftPeriodIds }
}

export interface ReportAggregationContext {
  publishedPeriods: AcademicPeriod[]
  priorResultsByPeriodId: Map<string, ReportCardResult>
  readiness: AggregationPublishReadiness
}

/** One shared snapshot for calculation, provenance and publication readiness. */
export async function loadReportAggregationContext(
  repositories: AggregationRepositories,
  studentId: string,
  aggregation: ReportCardAggregation,
  target?: AcademicPeriod,
  draftPolicyRevision?: number,
): Promise<ReportAggregationContext> {
  if (new Set(aggregation.sourcePeriodIds).size !== aggregation.sourcePeriodIds.length || (target && aggregation.sourcePeriodIds.includes(target.id)))
    throw new BusinessRuleViolationError('AGGREGATED_REPORT_CARD_PERIODS_INVALID', 'Contributing periods must be distinct and exclude the target')
  const periods = await repositories.academicPeriods.findByIds(aggregation.sourcePeriodIds)
  if (target && (periods.length !== aggregation.sourcePeriodIds.length || periods.some(period => period.schoolId !== target.schoolId || period.academicYearId !== target.academicYearId)))
    throw new BusinessRuleViolationError('AGGREGATED_REPORT_CARD_PERIODS_INVALID', 'Contributing periods must belong to the same school and academic year')
  const publishedPeriods = periods.filter(period => period.isPublished)
  const publishedIds = new Set(publishedPeriods.map(period => period.id))
  const unpublishedPeriodIds = aggregation.sourcePeriodIds.filter(id => !publishedIds.has(id))
  const prior = aggregation.source === ReportCardAggregationSource.ReportCards
    ? await loadPriorReportCardResults(repositories, { studentId, sourcePeriodIds: aggregation.sourcePeriodIds })
    : { publishedByPeriodId: new Map<string, ReportCardResult>(), missingOrDraftPeriodIds: [] }
  return {
    publishedPeriods,
    priorResultsByPeriodId: new Map([...prior.publishedByPeriodId].map(([id, result]) => [id, draftPolicyRevision !== undefined && result.revisedDraft?.gradingPolicyRevision === draftPolicyRevision ? hydrateReportRevision(result.revisedDraft) : result])),
    readiness: {
      canPublish: unpublishedPeriodIds.length === 0 && prior.missingOrDraftPeriodIds.length === 0
        && [...prior.publishedByPeriodId.values()].every(result => !result.revisedDraft && !result.calculationStale && !result.pendingCorrectionIds?.length && !result.pendingAssessmentIds?.length),
      unpublishedPeriodIds,
      missingOrDraftReportCardPeriodIds: prior.missingOrDraftPeriodIds,
    },
  }
}

export async function evaluateAggregationPublishReadiness(
  repositories: AggregationRepositories,
  studentId: string,
  aggregation: ReportCardAggregation,
): Promise<AggregationPublishReadiness> {
  return (await loadReportAggregationContext(repositories, studentId, aggregation)).readiness
}

export function buildSubjectAverageFromPriorReportCards(
  sectionId: string,
  aggregation: ReportCardAggregation,
  priorResultsByPeriodId: ReadonlyMap<string, ReportCardResult>,
  subject?: { id: string, byClassSubject: ReadonlyMap<string, string> },
  policy?: GradingPolicy,
): number | undefined {
  let sumWeights = 0
  let sumWeightedPoints = 0
  for (const sourcePeriodId of aggregation.sourcePeriodIds) {
    const priorResult = priorResultsByPeriodId.get(sourcePeriodId)
    if (!priorResult) {
      continue
    }
    const findSubject = (sections: readonly ReportCardResultSection[]): number | undefined => {
      for (const section of sections) {
        if (section.classSubjectId && subject?.byClassSubject.get(section.classSubjectId) === subject?.id)
          return policy ? section.grading?.value ?? section.average : section.average
        const nested = findSubject(section.subResults)
        if (nested !== undefined)
          return nested
      }
      return undefined
    }
    const average = subject ? findSubject(priorResult.sectionResults) : findSectionAverage(priorResult.sectionResults, sectionId)
    if (average === undefined) {
      continue
    }
    const weight = weightForPeriod(aggregation, sourcePeriodId)
    sumWeights += weight
    sumWeightedPoints += average * weight
  }
  if (sumWeights === 0) {
    return undefined
  }
  return sumWeightedPoints / sumWeights
}

export function assertAggregationSource(
  aggregation: ReportCardAggregation,
  source: ReportCardAggregationSource,
): void {
  if (aggregation.source !== source) {
    throw new BusinessRuleViolationError(
      'UNSUPPORTED_AGGREGATION_SOURCE',
      `Expected aggregation source ${source} but received ${aggregation.source}`,
    )
  }
}

export function findSectionAverage(sections: readonly ReportCardResultSection[], id: string): number | undefined {
  for (const section of sections) {
    if (section.sectionId === id)
      return section.grading?.value ?? section.average
    const value = findSectionAverage(section.subResults, id)
    if (value !== undefined)
      return value
  }
  return undefined
}
