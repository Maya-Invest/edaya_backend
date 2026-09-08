import type { StructureTemplateDefinition } from '../../../src/capabilities/onboarding/structure-template-types'
import { describe, expect, it } from 'bun:test'
import { collectTemplateReportCardPeriods } from '../../../src/capabilities/onboarding/ensure-academic-periods-from-template'

describe('ensureAcademicPeriodsFromTemplates helpers', () => {
  it('collects teaching periods from a college template without synthèse', () => {
    const college: StructureTemplateDefinition = {
      id: 'ci-college',
      countryCode: 'CI',
      label: 'Collège',
      description: 'Test',
      cycle: 'college',
      reportCardStructure: {
        gradingScale: 20,
        passingGrade: 10,
        includeSummary: false,
        periods: [
          { code: 'T1', name: 'Trimestre 1', weight: 1 },
          { code: 'T2', name: 'Trimestre 2', weight: 1 },
          { code: 'T3', name: 'Trimestre 3', weight: 1 },
        ],
      },
      gradeLevels: [],
      subjects: [],
      curriculum: [],
    }

    const periods = collectTemplateReportCardPeriods([college])
    expect(periods.map(period => period.code)).toEqual(['T1', 'T2', 'T3'])
    expect(periods.some(period => period.code === 'SYNTHESE')).toBe(false)
  })
})
