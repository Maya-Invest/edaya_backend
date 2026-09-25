import type { ReportCardAggregation } from '@edaya/core'
import { BusinessRuleViolationError, ReportCardAggregationSource, ReportCardDefinitionSectionKind, ReportCardResultSection, ReportCardResultStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import {
  assertAggregationSource,
  buildGroupResultFromChildren,
  buildSubjectAverageFromAssessments,
  buildSubjectAverageFromPriorReportCards,
  childReportCardDefinitionSections,
  evaluateAggregationPublishReadiness,
  findSectionAverage,
  listAssessmentResultsForStudentAndPeriods,
  listPublishedPeriodIds,
  loadPriorReportCardResults,
  rootReportCardDefinitionSections,
} from '../../../src/services/workflows/report-card-aggregation'

describe('report card aggregation helpers', () => {
  test('findSectionAverage walks nested section results', () => {
    const average = findSectionAverage([
      new ReportCardResultSection({
        sectionId: 'sec-root',
        sectionKind: ReportCardDefinitionSectionKind.Group,
        name: 'Root',
        average: 15,
        weight: 1,
        subResults: [
          new ReportCardResultSection({
            sectionId: 'sec-math',
            sectionKind: ReportCardDefinitionSectionKind.Subject,
            name: 'Math',
            average: 16,
            weight: 1,
            classSubjectId: 'cs1',
            subResults: [],
          }),
        ],
      }),
    ], 'sec-math')

    expect(average).toBe(16)
  })

  test('buildSubjectAverageFromPriorReportCards applies period weights', () => {
    const aggregation: ReportCardAggregation = {
      source: ReportCardAggregationSource.ReportCards,
      sourcePeriodIds: ['per-t1', 'per-t2'],
      periodWeightsByPeriodId: {
        'per-t1': 1,
        'per-t2': 3,
      },
    }
    const average = buildSubjectAverageFromPriorReportCards(
      'sec-math',
      aggregation,
      new Map([
        ['per-t1', {
          sectionResults: [
            new ReportCardResultSection({
              sectionId: 'sec-math',
              sectionKind: ReportCardDefinitionSectionKind.Subject,
              name: 'Math',
              average: 10,
              weight: 1,
              classSubjectId: 'cs1',
              subResults: [],
            }),
          ],
          status: ReportCardResultStatus.Published,
        } as never],
        ['per-t2', {
          sectionResults: [
            new ReportCardResultSection({
              sectionId: 'sec-math',
              sectionKind: ReportCardDefinitionSectionKind.Subject,
              name: 'Math',
              average: 14,
              weight: 1,
              classSubjectId: 'cs1',
              subResults: [],
            }),
          ],
          status: ReportCardResultStatus.Published,
        } as never],
      ]),
    )

    expect(average).toBe(13)
  })

  test('loadPriorReportCardResults skips draft source report cards without throwing', async () => {
    const { publishedByPeriodId, missingOrDraftPeriodIds } = await loadPriorReportCardResults(
      { results: { list: async () => [{ periodId: 'per-t1', status: ReportCardResultStatus.Published, sectionResults: [] }] } } as never,
      { studentId: 'stu1', sourcePeriodIds: ['per-t1', 'per-t2', 'per-t3'] },
    )

    expect([...publishedByPeriodId.keys()]).toEqual(['per-t1'])
    expect(missingOrDraftPeriodIds.sort()).toEqual(['per-t2', 'per-t3'])
  })

  test('evaluateAggregationPublishReadiness requires published periods and source bulletins', async () => {
    const baseService = {
      academicPeriods: { findByIds: async (ids: string[]) => ids.map(id => ({ id, isPublished: id !== 'per-t2' })) },
      results: { list: async () => [{ periodId: 'per-t1', status: ReportCardResultStatus.Published }] },
    } as never

    const aggregation: ReportCardAggregation = {
      source: ReportCardAggregationSource.ReportCards,
      sourcePeriodIds: ['per-t1', 'per-t2'],
    }

    const readiness = await evaluateAggregationPublishReadiness(baseService, 'stu1', aggregation)
    expect(readiness.canPublish).toBe(false)
    expect(readiness.unpublishedPeriodIds).toEqual(['per-t2'])
    expect(readiness.missingOrDraftReportCardPeriodIds).toEqual(['per-t2'])
  })

  test('rootReportCardDefinitionSections preserves distinct stable identities with the same name', () => {
    const roots = rootReportCardDefinitionSections([
      { id: 'sec-a', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Group, name: 'Core', order: 1, weight: 1 },
      { id: 'sec-b', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Group, name: 'Core', order: 2, weight: 1 },
      { id: 'sec-child', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Subject, name: 'Math', order: 1, weight: 1, parentSectionId: 'sec-a', subjectId: 'sub1' },
    ] as never)

    expect(roots.map(section => section.id)).toEqual(['sec-a', 'sec-b'])
  })

  test('childReportCardDefinitionSections keeps only the first subject section per subjectId', () => {
    const children = childReportCardDefinitionSections([
      { id: 'sec-math-1', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Subject, name: 'Math A', order: 1, weight: 1, parentSectionId: 'root', subjectId: 'sub-math' },
      { id: 'sec-math-2', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Subject, name: 'Math B', order: 2, weight: 1, parentSectionId: 'root', subjectId: 'sub-math' },
      { id: 'sec-group', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Group, name: 'Nested', order: 3, weight: 1, parentSectionId: 'root' },
    ] as never, 'root')

    expect(children.map(section => section.id)).toEqual(['sec-math-1', 'sec-group'])
  })

  test('buildSubjectAverageFromAssessments returns undefined without scores and 0 when weights sum to zero', () => {
    expect(buildSubjectAverageFromAssessments('cs1', [])).toBeUndefined()
    expect(buildSubjectAverageFromAssessments('cs1', [{
      result: { score: 10 } as never,
      assessment: { marksStatus: 'submitted', classSubjectId: 'cs1', maxScore: 20, coefficient: 0 } as never,
    }])).toBe(0)
  })

  test('buildGroupResultFromChildren returns null when there are no child results', () => {
    expect(buildGroupResultFromChildren({
      id: 'sec-root',
      reportCardDefinitionId: 'def1',
      kind: ReportCardDefinitionSectionKind.Group,
      name: 'Root',
      order: 1,
      weight: 1,
    } as never, [])).toBeNull()
  })

  test('listPublishedPeriodIds and listAssessmentResultsForStudentAndPeriods honor published periods', async () => {
    const baseService = {
      academicPeriods: { findByIds: async (ids: string[]) => ids.map(id => ({ id, isPublished: id === 'per-t1' })) },
      assessmentResults: { list: async () => [{ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 15 }] },
      assessments: { list: async () => [{ id: 'ass1', periodId: 'per-t1', classSubjectId: 'cs1', marksStatus: 'submitted' }] },
    } as never

    const published = await listPublishedPeriodIds(baseService, ['per-t1', 'per-t2'])
    expect([...published]).toEqual(['per-t1'])

    const onlyPublished = await listAssessmentResultsForStudentAndPeriods(baseService, 'stu1', ['per-t1', 'per-t2'], {
      onlyPublishedPeriods: true,
    })
    expect(onlyPublished).toHaveLength(1)
  })

  test('evaluateAggregationPublishReadiness allows assessment-based aggregation when source periods are published', async () => {
    const readiness = await evaluateAggregationPublishReadiness({
      academicPeriods: { findByIds: async (ids: string[]) => ids.map(id => ({ id, isPublished: true })) },
    } as never, 'stu1', {
      source: ReportCardAggregationSource.Assessments,
      sourcePeriodIds: ['per-t1', 'per-t2'],
    })

    expect(readiness.canPublish).toBe(true)
    expect(readiness.missingOrDraftReportCardPeriodIds).toEqual([])
  })

  test('assertAggregationSource rejects mismatched aggregation sources', () => {
    expect(() => assertAggregationSource({
      source: ReportCardAggregationSource.Assessments,
      sourcePeriodIds: ['per-t1'],
    }, ReportCardAggregationSource.ReportCards)).toThrow(BusinessRuleViolationError)
  })
})
