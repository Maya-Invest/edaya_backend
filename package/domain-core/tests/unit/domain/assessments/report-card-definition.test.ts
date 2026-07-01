import { describe, expect, test } from 'bun:test'
import {
  ReportCardDefinition,
  ReportCardDefinitionStatus,
} from '../../../../src/domain/assessments/report-card-definition'

describe('ReportCardDefinition entity', () => {
  const baseArgs = {
    id: 'rcd-ms-6',
    schoolId: 'sch1',
    academicYearId: '2025',
    gradeLevelId: 'gl-6',
    gradeScaleId: 'gs-20',
    name: 'Bulletin trimestriel — Collège (6ème)',
    status: ReportCardDefinitionStatus.Published,
    isDefault: true,
  }

  test('instantiates successfully with gradeScaleId and status', () => {
    const definition = new ReportCardDefinition(baseArgs)

    expect(definition.id).toBe('rcd-ms-6')
    expect(definition.gradeScaleId).toBe('gs-20')
    expect(definition.status).toBe(ReportCardDefinitionStatus.Published)
    expect(definition.isDefault).toBe(true)
  })

  test('defaults status to draft when omitted', () => {
    const definition = new ReportCardDefinition({
      id: 'rcd-ms-draft',
      schoolId: 'sch1',
      academicYearId: '2025',
      gradeLevelId: 'gl-6',
      gradeScaleId: 'gs-20',
      name: 'Bulletin trimestriel — Collège (modèle brouillon)',
    })

    expect(definition.status).toBe(ReportCardDefinitionStatus.Draft)
  })
})
