import type { ReportCardAggregation } from '@edaya/core'
import { BusinessRuleViolationError, ReportCardAggregationSource, ReportCardResultSection, ReportCardResultSectionKind, ReportCardResultStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import {
  assertAggregationSource,
  buildSubjectAverageFromAssessments,
  buildSubjectAverageFromPriorReportCards,
  evaluateAggregationPublishReadiness,
  findSectionAverage,
  listAssessmentResultsForStudentAndPeriods,
  listPublishedPeriodIds,
  loadPriorReportCardResults,
} from '../../../src/services/workflows/report-card-aggregation'

describe('report card aggregation helpers', () => {
  test('findSectionAverage walks nested section results', () => {
    const average = findSectionAverage([
      new ReportCardResultSection({
        sectionId: 'sec-root',
        sectionKind: ReportCardResultSectionKind.Module,
        name: 'Root',
        average: 15,
        weight: 1,
        subResults: [
          new ReportCardResultSection({
            sectionId: 'sec-math',
            sectionKind: ReportCardResultSectionKind.Subject,
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
              sectionKind: ReportCardResultSectionKind.Subject,
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
              sectionKind: ReportCardResultSectionKind.Subject,
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

  test('buildSubjectAverageFromAssessments returns undefined without scores or contributing assessment weight', () => {
    expect(buildSubjectAverageFromAssessments('cs1', [])).toBeUndefined()
    expect(buildSubjectAverageFromAssessments('cs1', [{
      result: { score: 10 } as never,
      assessment: { marksStatus: 'submitted', classSubjectId: 'cs1', maxScore: 20, coefficient: 0 } as never,
    }])).toBeUndefined()
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
