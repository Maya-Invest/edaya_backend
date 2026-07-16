import { AttendanceSummary, ReportCardAggregationSource, ReportCardDefinitionSection, ReportCardDefinitionSectionKind, ReportCardDefinitionSectionRole, ReportCardResult, ReportCardResultStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('ReportCardDefinitionSection role and coefficient', () => {
  test('persists role and coefficient on group sections', () => {
    const section = new ReportCardDefinitionSection({
      id: 'rcs-ms-sci',
      reportCardDefinitionId: 'rcd-ms-6',
      name: 'Sciences & langues',
      kind: ReportCardDefinitionSectionKind.Group,
      role: ReportCardDefinitionSectionRole.Subjects,
      coefficient: 1.5,
      order: 2,
      weight: 2,
    })

    expect(section.role).toBe(ReportCardDefinitionSectionRole.Subjects)
    expect(section.coefficient).toBe(1.5)
  })

  test('allows summary sections without coefficient', () => {
    const section = new ReportCardDefinitionSection({
      id: 'rcs-ms-synth',
      reportCardDefinitionId: 'rcd-ms-6',
      name: 'Synthèse trimestrielle',
      kind: ReportCardDefinitionSectionKind.Group,
      role: ReportCardDefinitionSectionRole.Summary,
      order: 4,
      weight: 1,
    })

    expect(section.role).toBe(ReportCardDefinitionSectionRole.Summary)
    expect(section.coefficient).toBeUndefined()
  })
})

describe('ReportCardResult aggregation provenance', () => {
  test('stores aggregation config on generated results', () => {
    const result = new ReportCardResult({
      id: 'rc1',
      reportCardDefinitionId: 'def1',
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
