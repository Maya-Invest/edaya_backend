import type {
  GradeScaleSeedRecord,
  ReportCardDefinitionSeedRecord,
  ReportCardResultSeedRecord,
  ReportCardSectionSeedRecord,
  ReportCardsSeedPort,
} from './port'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevReportCards } from './workflow'

describe('report-cards seed port workflow', () => {
  test('seeds scales, definitions, sections, and generated or published results', async () => {
    const results = demoCiDataset.extensions?.reportCardResults ?? []
    const publishedCount = results.filter(
      result => result.narrativeStatus === 'published' && result.publishedAt,
    ).length
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
      saveReportCardTeacherComment: async () => {},
      publishReportCardResult: async (record) => {
        published.push(record)
      },
    }

    const counts = await seedDevReportCards(port, demoCiDataset)

    expect(counts).toEqual({
      gradeScales: scales.length,
      definitions: definitions.length,
      sections: sections.length,
      results: generated.length,
    })
    expect(scales).toHaveLength(demoCiDataset.entities.gradeScales?.length ?? 0)
    expect(definitions).toHaveLength(demoCiDataset.extensions?.reportCardDefinitionFixtures?.length ?? 0)
    expect(published).toHaveLength(publishedCount)
    expect(generated[0]?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
  })
})
