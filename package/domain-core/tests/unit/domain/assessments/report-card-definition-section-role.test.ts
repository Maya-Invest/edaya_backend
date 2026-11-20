import { AttendanceSummary, ReportCardAggregationSource, ReportCardResult, ReportCardResultStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('ReportCardResult aggregation provenance', () => {
  test('stores aggregation config on generated results', () => {
    const result = new ReportCardResult({
      id: 'rc1',
      gradeLevelId: 'grade1',
      academicYearId: 'ay1',
      reportConfigurationRevision: 0,
      studentId: 'stu1',
      classGroupId: 'cg1',
      periodId: 'per-synth',
      sectionResults: [],
      attendanceSummary: new AttendanceSummary({
        presentCount: 0,
        absenceCount: 0,
        excusedAbsenceCount: 0,
        lateCount: 0,
      }),
      assessmentResultCount: 0,
      status: ReportCardResultStatus.Draft,
      aggregation: {
        source: ReportCardAggregationSource.ReportCards,
        sourcePeriodIds: ['per-t1', 'per-t2', 'per-t3'],
      },
    })

    expect(result.aggregation?.source).toBe(ReportCardAggregationSource.ReportCards)
    expect(result.aggregation?.sourcePeriodIds).toEqual(['per-t1', 'per-t2', 'per-t3'])
  })
})
