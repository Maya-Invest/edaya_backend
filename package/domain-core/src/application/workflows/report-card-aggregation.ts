import type { Assessment, AssessmentResult, ReportCardDefinitionSection, ReportCardResult, ReportCardResultSection } from '../../domain'
import type { ReportCardAggregation } from '../../domain/assessments/report-card-aggregation-config'
import type { BaseSchoolService } from '../base-school-service'
import {
  ReportCardAggregationSource,
  ReportCardDefinitionSectionKind,
  ReportCardResultSection as ReportCardResultSectionEntity,
  ReportCardResultStatus,
  weightForPeriod,
} from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { roundTo2 } from '../../domain/shared/utils'

export interface AggregationPublishReadiness {
  canPublish: boolean
  unpublishedPeriodIds: string[]
  missingOrDraftReportCardPeriodIds: string[]
}

export function findSectionAverage(
  sectionResults: readonly ReportCardResultSection[],
  sectionId: string,
): number | undefined {
  for (const section of sectionResults) {
    if (section.sectionId === sectionId) {
      return section.average
    }
    const nested = findSectionAverage(section.subResults, sectionId)
    if (nested !== undefined) {
      return nested
    }
  }
  return undefined
}

export async function listPublishedPeriodIds(
  baseService: BaseSchoolService,
  periodIds: readonly string[],
): Promise<Set<string>> {
  const published = new Set<string>()
  for (const periodId of periodIds) {
    const period = await baseService.repositories.academicPeriods.findById(periodId)
    if (period?.isPublished) {
      published.add(periodId)
    }
  }
  return published
}

export async function listAssessmentResultsForStudentAndPeriods(
  baseService: BaseSchoolService,
  studentId: string,
  periodIds: readonly string[],
  options: { onlyPublishedPeriods?: boolean } = {},
): Promise<Array<{ result: AssessmentResult, assessment: Assessment }>> {
  const eligiblePeriodIds = options.onlyPublishedPeriods
    ? await listPublishedPeriodIds(baseService, periodIds)
    : new Set(periodIds)
  const results = await baseService.repositories.assessmentResults.list({ studentId })
  const resolved: Array<{ result: AssessmentResult, assessment: Assessment }> = []
  for (const result of results) {
    const assessment = await baseService.repositories.assessments.findById(result.assessmentId)
    if (assessment?.periodId && eligiblePeriodIds.has(assessment.periodId)) {
      resolved.push({ result, assessment })
    }
  }
  return resolved
}

export function buildSubjectAverageFromAssessments(
  classSubjectId: string,
  assessmentsWithResults: Array<{ result: AssessmentResult, assessment: Assessment }>,
): number | undefined {
  const leafResults = assessmentsWithResults
    .filter(({ assessment, result }) => assessment.classSubjectId === classSubjectId && result.score !== undefined)
  if (leafResults.length === 0) {
    return undefined
  }
  const totalWeight = leafResults.reduce((sum, { assessment }) => sum + assessment.coefficient, 0)
  const weightedPoints = leafResults.reduce((sum, { result, assessment }) => {
    const normalizedScore = ((result.score ?? 0) / assessment.maxScore) * 20
    return sum + normalizedScore * assessment.coefficient
  }, 0)
  return totalWeight === 0 ? 0 : roundTo2(weightedPoints / totalWeight)
}

export interface PriorReportCardLoadResult {
  publishedByPeriodId: Map<string, ReportCardResult>
  missingOrDraftPeriodIds: string[]
}

export async function loadPriorReportCardResults(
  baseService: BaseSchoolService,
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
  for (const sourcePeriodId of sourcePeriodIds) {
    const reportCard = await baseService.repositories.results.findOne({
      studentId,
      periodId: sourcePeriodId,
    })
    if (!reportCard || reportCard.status !== ReportCardResultStatus.Published) {
      missingOrDraftPeriodIds.push(sourcePeriodId)
      continue
    }
    publishedByPeriodId.set(sourcePeriodId, reportCard)
  }
  return { publishedByPeriodId, missingOrDraftPeriodIds }
}

export async function evaluateAggregationPublishReadiness(
  baseService: BaseSchoolService,
  studentId: string,
  aggregation: ReportCardAggregation,
): Promise<AggregationPublishReadiness> {
  const unpublishedPeriodIds: string[] = []
  for (const periodId of aggregation.sourcePeriodIds) {
    const period = await baseService.repositories.academicPeriods.findById(periodId)
    if (!period?.isPublished) {
      unpublishedPeriodIds.push(periodId)
    }
  }

  if (aggregation.source === ReportCardAggregationSource.Assessments) {
    return {
      canPublish: unpublishedPeriodIds.length === 0,
      unpublishedPeriodIds,
      missingOrDraftReportCardPeriodIds: [],
    }
  }

  const { missingOrDraftPeriodIds } = await loadPriorReportCardResults(baseService, {
    studentId,
    sourcePeriodIds: aggregation.sourcePeriodIds,
  })
  return {
    canPublish: unpublishedPeriodIds.length === 0 && missingOrDraftPeriodIds.length === 0,
    unpublishedPeriodIds,
    missingOrDraftReportCardPeriodIds: missingOrDraftPeriodIds,
  }
}

export function buildSubjectAverageFromPriorReportCards(
  sectionId: string,
  aggregation: ReportCardAggregation,
  priorResultsByPeriodId: ReadonlyMap<string, ReportCardResult>,
): number | undefined {
  let sumWeights = 0
  let sumWeightedPoints = 0
  for (const sourcePeriodId of aggregation.sourcePeriodIds) {
    const priorResult = priorResultsByPeriodId.get(sourcePeriodId)
    if (!priorResult) {
      continue
    }
    const average = findSectionAverage(priorResult.sectionResults, sectionId)
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
  return roundTo2(sumWeightedPoints / sumWeights)
}

export function buildGroupResultFromChildren(
  section: ReportCardDefinitionSection,
  childResults: ReportCardResultSection[],
): ReportCardResultSection | null {
  if (childResults.length === 0) {
    return null
  }
  let sumWeights = 0
  let sumWeightedPoints = 0
  for (const childResult of childResults) {
    sumWeights += childResult.weight
    sumWeightedPoints += childResult.average * childResult.weight
  }
  return new ReportCardResultSectionEntity({
    sectionId: section.id,
    sectionKind: ReportCardDefinitionSectionKind.Group,
    name: section.name,
    average: sumWeights === 0 ? 0 : sumWeightedPoints / sumWeights,
    weight: section.weight,
    parentSectionId: section.parentSectionId,
    subResults: childResults,
  })
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
