import type { FixtureDataset } from '@edaya/fixtures'
import type { ReportCardsSeedPort } from './port'
import { rangesFromThresholds, ReportCardDefinitionKind, ReportCardDefinitionSectionKind, ReportCardDefinitionStatus } from '@edaya/core'
import { seedDateTime } from '../../support/seed-date'

export interface DevReportCardSeedCounts {
  gradeScales: number
  definitions: number
  sections: number
  results: number
}

export async function seedDevReportCardConfiguration(
  port: ReportCardsSeedPort,
  dataset: FixtureDataset,
): Promise<Omit<DevReportCardSeedCounts, 'results'>> {
  const gradeScaleFixtures = dataset.extensions?.reportCardGradeScaleFixtures ?? []
  const definitionFixtures = dataset.extensions?.reportCardDefinitionFixtures ?? []

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

  let sectionCount = 0
  const configured = new Map<string, string>()

  for (const fixture of definitionFixtures) {
    const definition = fixture.definition
    const scope = `${definition.gradeLevelId}/${definition.academicYearId}`
    if (configured.has(scope) && configured.get(scope) !== definition.gradeScaleId)
      throw new Error(`Conflicting seed grading scales for ${scope}`)
    if (!configured.has(scope)) {
      await port.configureGrading({ gradeLevelId: definition.gradeLevelId, academicYearId: definition.academicYearId, scaleId: definition.gradeScaleId, mode: 'numeric-first', aggregateLabel: 'Moyenne générale' })
      configured.set(scope, definition.gradeScaleId)
    }
    await port.createReportCardDefinition({
      id: definition.id,
      schoolId: definition.schoolId,
      academicYearId: definition.academicYearId,
      gradeLevelId: definition.gradeLevelId,
      gradeScaleId: definition.gradeScaleId,
      passThreshold: definition.passThreshold ?? undefined,
      name: definition.name,
      kind: definition.kind ?? ReportCardDefinitionKind.Default,
      status: definition.status ?? ReportCardDefinitionStatus.Draft,
      isDefault: definition.isDefault ?? false,
      description: definition.description ?? definition.name,
    })

    for (const section of fixture.sections) {
      await port.createReportCardSection({
        id: section.id,
        reportCardDefinitionId: definition.id,
        name: section.name,
        kind: ReportCardDefinitionSectionKind.Group,
        role: section.role,
        coefficient: section.coefficient,
        order: section.order,
        weight: section.weight > 0 ? section.weight : 1,
      })
      sectionCount += 1

      for (const subjectId of section.subjectIds) {
        await port.createReportCardSection({
          id: `${section.id}-${subjectId}`,
          reportCardDefinitionId: definition.id,
          name: subjectId,
          kind: ReportCardDefinitionSectionKind.Subject,
          order: 1,
          weight: 1,
          parentSectionId: section.id,
          subjectId,
        })
        sectionCount += 1
      }
    }
  }

  return { gradeScales: gradeScaleFixtures.length, definitions: definitionFixtures.length, sections: sectionCount }
}

export async function seedDevReportCardResults(port: ReportCardsSeedPort, dataset: FixtureDataset): Promise<Pick<DevReportCardSeedCounts, 'results'>> {
  const results = dataset.extensions?.reportCardResults ?? []
  for (const result of results) {
    const record = {
      id: result.id,
      studentId: result.studentId,
      periodId: result.periodId,
      reportCardDefinitionId: result.reportCardDefinitionId,
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
