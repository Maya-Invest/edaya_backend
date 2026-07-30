import type { FixtureDataset } from '@edaya/fixtures'
import type { ReportCardsSeedPort } from './port'
import { ReportCardDefinitionKind, ReportCardDefinitionSectionKind, ReportCardDefinitionStatus } from '@edaya/core'
import { seedDateTime } from '../../support/seed-date'

export interface DevReportCardSeedCounts {
  gradeScales: number
  definitions: number
  sections: number
  results: number
}

export async function seedDevReportCards(
  port: ReportCardsSeedPort,
  dataset: FixtureDataset,
): Promise<DevReportCardSeedCounts> {
  const gradeScaleFixtures = dataset.extensions?.reportCardGradeScaleFixtures ?? []
  const definitionFixtures = dataset.extensions?.reportCardDefinitionFixtures ?? []
  const results = dataset.extensions?.reportCardResults ?? []

  for (const fixture of gradeScaleFixtures) {
    const scale = fixture.scale
    await port.createGradeScale({
      id: scale.id,
      schoolId: scale.schoolId,
      name: scale.name,
      minScore: scale.minScore,
      maxScore: scale.maxScore,
      decimalPlaces: scale.decimalPlaces ?? 1,
      description: scale.description ?? undefined,
      isDefault: scale.isDefault ?? false,
      ranges: (scale.ranges ?? []).map(range => ({
        letter: range.letter,
        minScore: range.minScore,
        maxScore: range.maxScore,
        isPassing: range.isPassing,
        interpretation: range.interpretation ?? undefined,
      })),
    })
  }

  let sectionCount = 0

  for (const fixture of definitionFixtures) {
    const definition = fixture.definition
    await port.createReportCardDefinition({
      id: definition.id,
      schoolId: definition.schoolId,
      academicYearId: definition.academicYearId,
      gradeLevelId: definition.gradeLevelId,
      gradeScaleId: definition.gradeScaleId,
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

  for (const result of results) {
    const record = {
      id: result.id,
      studentId: result.studentId,
      periodId: result.periodId,
      reportCardDefinitionId: result.reportCardDefinitionId,
      generatedAt: seedDateTime(result.generatedAt),
      overallAverage: result.overallAverage,
      rank: result.classRank,
      classSize: result.classSize,
      sectionMarks: result.sectionMarks,
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

  return {
    gradeScales: gradeScaleFixtures.length,
    definitions: definitionFixtures.length,
    sections: sectionCount,
    results: results.length,
  }
}
