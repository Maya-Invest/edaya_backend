import type {
  GradeScaleSeedRecord,
  ReportCardDefinitionSeedRecord,
  ReportCardResultSeedRecord,
  ReportCardSectionSeedRecord,
  ReportCardsSeedPort,
} from './port'
import { GradeScale } from '@edaya/core'
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
    const seeded = new GradeScale({ ...scales[0]!, ranges: [...scales[0]!.ranges] })
    expect(seeded.intervalConvention).toBe('continuous')
    expect(seeded.ranges.map(row => row.id)).toEqual(demoCiDataset.entities.gradeScales![0]!.ranges.map(row => row.id))
    expect(seeded.ranges.every(row => !!row.id)).toBe(true)
    expect(seeded.findRange(9.999)?.letter).toBe('D')
    expect(seeded.findRange(10)?.letter).toBe('C')
    expect(seeded.findRange(20)?.letter).toBe('A')
    expect(seeded.findRange(20.001)).toBeUndefined()
    expect(definitions).toHaveLength(demoCiDataset.extensions?.reportCardDefinitionFixtures?.length ?? 0)
    expect(published).toHaveLength(publishedCount)
    expect(generated[0]?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
  })
})
