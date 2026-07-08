import type { Assessment, AssessmentResult, ReportCardAggregation, ReportCardDefinitionSection, ReportCardResult, ReportCardResultSection } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import {
  BusinessRuleViolationError,
  ReportCardAggregationSource,
  ReportCardDefinitionSectionKind,
  ReportCardResultSection as ReportCardResultSectionEntity,
  ReportCardResultStatus,
  roundTo2,
  weightForPeriod,
} from '@edaya/core'

export interface AggregationPublishReadiness {
  canPublish: boolean
  unpublishedPeriodIds: string[]
  missingOrDraftReportCardPeriodIds: string[]
}

export function dedupeReportCardDefinitionSections(
  sections: readonly ReportCardDefinitionSection[],
): ReportCardDefinitionSection[] {
  const byId = new Map<string, ReportCardDefinitionSection>()
  for (const section of sections) {
    if (!byId.has(section.id)) {
      byId.set(section.id, section)
    }
  }
  return [...byId.values()]
}

export function rootReportCardDefinitionSections(
  sections: readonly ReportCardDefinitionSection[],
): ReportCardDefinitionSection[] {
  const byName = new Map<string, ReportCardDefinitionSection>()
  for (const section of dedupeReportCardDefinitionSections(sections)) {
    if (section.parentSectionId) {
      continue
    }
    if (!byName.has(section.name)) {
      byName.set(section.name, section)
    }
  }
  return [...byName.values()]
}

export function childReportCardDefinitionSections(
  sections: readonly ReportCardDefinitionSection[],
  parentSectionId: string,
): ReportCardDefinitionSection[] {
  const seenSubjectIds = new Set<string>()
  return dedupeReportCardDefinitionSections(sections)
    .filter(section => section.parentSectionId === parentSectionId)
    .filter((section) => {
      if (section.kind !== ReportCardDefinitionSectionKind.Subject || !section.subjectId) {
        return true
      }
      if (seenSubjectIds.has(section.subjectId)) {
        return false
      }
      seenSubjectIds.add(section.subjectId)
      return true
    })
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
