import type { FixtureDataset } from '@edaya/fixtures'
import type { ReportCardsSeedPort } from './port'
import { rangesFromThresholds } from '@edaya/core'
import { seedDateTime } from '../../support/seed-date'

export interface DevReportCardSeedCounts {
  gradeScales: number
  modules: number
  assignments: number
  results: number
}

export async function seedDevReportCardConfiguration(
  port: ReportCardsSeedPort,
  dataset: FixtureDataset,
): Promise<Omit<DevReportCardSeedCounts, 'results'>> {
  const gradeScaleFixtures = dataset.extensions?.reportCardGradeScaleFixtures ?? []
  const definitionFixtures = dataset.extensions?.reportConfigurationFixtures ?? []

  for (const fixture of gradeScaleFixtures) {
    const scale = fixture.scale
    await port.createGradeScale({
      id: scale.id,
      schoolId: scale.schoolId,
      name: scale.name,
      minScore: scale.minScore,
      maxScore: scale.maxScore,
      decimalPlaces: scale.decimalPlaces ?? 1,
      intervalConvention: 'continuous',
      roundingMode: scale.roundingMode ?? 'nearest',
      description: scale.description ?? undefined,
      isDefault: scale.isDefault ?? false,
      ranges: rangesFromThresholds((scale.ranges ?? []).map(range => ({
        id: range.id ?? `${scale.id}-${range.letter}`,
        gpaValue: range.gpaValue ?? undefined,
        letter: range.letter,
        minScore: range.minScore,

        interpretation: range.interpretation ?? undefined,
      })), scale.maxScore).map(range => ({ ...range, id: range.id! })),
    })
  }

  let moduleCount = 0
  let assignmentCount = 0
  for (const fixture of definitionFixtures) {
    await port.configureGrading({ gradeLevelId: fixture.gradeLevelId, academicYearId: fixture.academicYearId, scaleId: fixture.gradeScaleId, mode: 'numeric-first', aggregateLabel: 'Moyenne générale' })
    await port.configureReport(fixture)
    moduleCount += fixture.modules.length
    assignmentCount += fixture.modules.reduce((sum, module) => sum + module.subjectIds.length, 0)
  }
  return { gradeScales: gradeScaleFixtures.length, modules: moduleCount, assignments: assignmentCount }
}

export async function seedDevReportCardResults(port: ReportCardsSeedPort, dataset: FixtureDataset): Promise<Pick<DevReportCardSeedCounts, 'results'>> {
  const results = dataset.extensions?.reportCardResults ?? []
  for (const result of results) {
    const record = {
      id: result.id,
      studentId: result.studentId,
      periodId: result.periodId,
      generatedAt: seedDateTime(result.generatedAt),
    }
    await port.generateReportCardResult(record)

    if (result.homeroomComment?.trim()) {
      await port.saveReportCardTeacherComment({
        id: result.id,
        teacherComment: result.homeroomComment.trim(),
      })
    }

    if (result.narrativeStatus === 'published' && result.publishedAt) {
      await port.publishReportCardResult({
        ...record,
        publishedAt: seedDateTime(result.publishedAt),
      })
    }
  }

  return { results: results.length }
}
