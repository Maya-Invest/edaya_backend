import type {
  GradeScaleSeedRecord,
  ReportCardDefinitionSeedRecord,
  ReportCardResultSeedRecord,
  ReportCardSectionSeedRecord,
  ReportCardsSeedPort,
} from './port'
import {
  SEED_GRADE_SCALES,
  SEED_REPORT_CARD_DEFINITIONS,
  SEED_REPORT_CARD_RESULTS,
} from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevReportCards } from './workflow'

describe('report-cards seed port workflow', () => {
  test('seeds scales, definitions, sections, and generated or published results', async () => {
    const scales: GradeScaleSeedRecord[] = []
    const definitions: ReportCardDefinitionSeedRecord[] = []
    const sections: ReportCardSectionSeedRecord[] = []
    const generated: ReportCardResultSeedRecord[] = []
    const published: ReportCardResultSeedRecord[] = []
    const port: ReportCardsSeedPort = {
      createGradeScale: async (record) => {
        scales.push(record)
      },
      createReportCardDefinition: async (record) => {
        definitions.push(record)
      },
      createReportCardSection: async (record) => {
        sections.push(record)
      },
      generateReportCardResult: async (record) => {
        generated.push(record)
      },
      publishReportCardResult: async (record) => {
        published.push(record)
      },
    }

    const counts = await seedDevReportCards(port)
    const expectedSections = SEED_REPORT_CARD_DEFINITIONS.reduce(
      (total, definition) => total + definition.sections.reduce(
        (sectionTotal, section) => sectionTotal + 1 + section.subjectIds.length,
        0,
      ),
      0,
    )
    const expectedPublished = SEED_REPORT_CARD_RESULTS.filter(
      result => result.mockStatus === 'published' && result.publishedAt,
    ).length

    expect(counts).toEqual({
      gradeScales: SEED_GRADE_SCALES.length,
      definitions: SEED_REPORT_CARD_DEFINITIONS.length,
      sections: expectedSections,
      results: SEED_REPORT_CARD_RESULTS.length,
    })
    expect(scales).toHaveLength(SEED_GRADE_SCALES.length)
    expect(definitions).toHaveLength(SEED_REPORT_CARD_DEFINITIONS.length)
    expect(sections).toHaveLength(expectedSections)
    expect(generated).toHaveLength(SEED_REPORT_CARD_RESULTS.length)
    expect(published).toHaveLength(expectedPublished)
    expect(generated[0]?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
  })
})
