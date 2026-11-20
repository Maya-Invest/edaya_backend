import type {
  GradeScaleSeedRecord,
  GradingPolicySeedRecord,
  ReportCardResultSeedRecord,
  ReportCardsSeedPort,
  ReportConfigurationSeedRecord,
} from './port'
import { GradeScale } from '@edaya/core'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevReportCardConfiguration, seedDevReportCardResults } from './workflow'

describe('report-cards seed port workflow', () => {
  test('seeds scales, flat modules, assignments, and generated or published results', async () => {
    const results = demoCiDataset.extensions?.reportCardResults ?? []
    const publishedCount = results.filter(
      result => result.narrativeStatus === 'published' && result.publishedAt,
    ).length
    const scales: GradeScaleSeedRecord[] = []
    const policies: GradingPolicySeedRecord[] = []
    const configurations: ReportConfigurationSeedRecord[] = []
    const generated: ReportCardResultSeedRecord[] = []
    const published: ReportCardResultSeedRecord[] = []
    const port: ReportCardsSeedPort = {
      createGradeScale: async (record) => {
        scales.push(record)
      },
      configureGrading: async (record) => {
        expect(scales.some(scale => scale.id === record.scaleId)).toBe(true)
        policies.push(record)
      },
      configureReport: async (record) => {
        expect(policies.some(policy => policy.gradeLevelId === record.gradeLevelId && policy.academicYearId === record.academicYearId)).toBe(true)
        configurations.push(record)
      },
      generateReportCardResult: async (record) => {
        generated.push(record)
      },
      saveReportCardTeacherComment: async () => {},
      publishReportCardResult: async (record) => {
        published.push(record)
      },
    }

    const configuration = await seedDevReportCardConfiguration(port, demoCiDataset)
    expect(generated).toHaveLength(0)
    expect(policies).toHaveLength(4)
    expect(policies.every(policy => policy.mode === 'numeric-first' && policy.scaleId === 'ci-gs-20')).toBe(true)
    const counts = { ...configuration, ...await seedDevReportCardResults(port, demoCiDataset) }

    expect(counts).toEqual({
      gradeScales: scales.length,
      modules: configurations.reduce((sum, config) => sum + config.modules.length, 0),
      assignments: configurations.reduce((sum, config) => sum + config.modules.reduce((count, module) => count + module.subjectIds.length, 0), 0),
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
    expect(configurations).toHaveLength(demoCiDataset.extensions?.reportConfigurationFixtures?.length ?? 0)
    expect(published).toHaveLength(publishedCount)
    expect(generated[0]?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
  })
})
