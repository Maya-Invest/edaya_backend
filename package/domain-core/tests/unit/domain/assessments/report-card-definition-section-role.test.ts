import { describe, expect, test } from 'bun:test'
import {
  ReportCardDefinitionSection,
  ReportCardDefinitionSectionKind,
  ReportCardDefinitionSectionRole,
} from '../../../../src/domains/assessments/report-card-definition-section'

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
