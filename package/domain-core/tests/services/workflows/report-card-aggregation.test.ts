import type { ReportCardAggregation } from '../../../src/domain'
import { describe, expect, test } from 'bun:test'
import {
  buildSubjectAverageFromPriorReportCards,
  evaluateAggregationPublishReadiness,
  findSectionAverage,
  loadPriorReportCardResults,
} from '../../../src/application/workflows/report-card-aggregation'
import {

  ReportCardAggregationSource,
  ReportCardDefinitionSectionKind,
  ReportCardResultSection,
  ReportCardResultStatus,
} from '../../../src/domain'

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
      {
        repositories: {
          results: {
            findOne: async ({ periodId }: { periodId: string }) => {
              if (periodId === 'per-t1') {
                return {
                  status: ReportCardResultStatus.Published,
                  sectionResults: [],
                }
              }
              if (periodId === 'per-t2') {
                return {
                  status: ReportCardResultStatus.Draft,
                  sectionResults: [],
                }
              }
              return undefined
            },
          },
        },
      } as never,
      { studentId: 'stu1', sourcePeriodIds: ['per-t1', 'per-t2', 'per-t3'] },
    )

    expect([...publishedByPeriodId.keys()]).toEqual(['per-t1'])
    expect(missingOrDraftPeriodIds.sort()).toEqual(['per-t2', 'per-t3'])
  })

  test('evaluateAggregationPublishReadiness requires published periods and source bulletins', async () => {
    const baseService = {
      repositories: {
        academicPeriods: {
          findById: async (id: string) => ({
            id,
            isPublished: id !== 'per-t2',
          }),
        },
        results: {
          findOne: async ({ periodId }: { periodId: string }) => {
            if (periodId === 'per-t1') {
              return { status: ReportCardResultStatus.Published }
            }
            return { status: ReportCardResultStatus.Draft }
          },
        },
      },
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
})
