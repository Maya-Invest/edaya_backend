import type { SchoolService } from '@edaya/core'
import type { SeedApplication } from './types'
import {
  ReportCardDefinitionKind,
  ReportCardDefinitionSectionKind,
  ReportCardDefinitionSectionRole,
  ReportCardDefinitionStatus,
} from '@edaya/core'
import {
  parseSeedDate,
  SEED_ACADEMIC_YEAR_ID,
  SEED_GRADE_SCALES,
  SEED_REPORT_CARD_DEFINITIONS,
  SEED_REPORT_CARD_RESULTS,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'

const SEED_SECTION_ROLE_BY_KIND = {
  matieres: ReportCardDefinitionSectionRole.Subjects,
  synthese: ReportCardDefinitionSectionRole.Summary,
  appreciation: ReportCardDefinitionSectionRole.Comments,
} as const

function mapDefinitionStatus(mockStatus: 'published' | 'draft'): ReportCardDefinitionStatus {
  return mockStatus === 'published'
    ? ReportCardDefinitionStatus.Published
    : ReportCardDefinitionStatus.Draft
}

export async function seedReportCards(
  _application: SeedApplication,
  service: SchoolService,
): Promise<{ gradeScales: number, definitions: number, sections: number, results: number }> {
  for (const scale of SEED_GRADE_SCALES) {
    await service.createGradeScale({
      id: scale.id,
      schoolId: SEED_SCHOOL_ID,
      name: scale.name,
      minScore: scale.minScore,
      maxScore: scale.maxScore,
      decimalPlaces: scale.mockDecimalPlaces,
      description: scale.mockDescription,
      isDefault: scale.isDefault,
      ranges: [...scale.ranges],
    })
  }

  let sectionCount = 0

  for (const definition of SEED_REPORT_CARD_DEFINITIONS) {
    await service.createReportCardDefinition({
      id: definition.id,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      gradeLevelId: definition.gradeLevelId,
      gradeScaleId: definition.gradeScaleId,
      name: definition.name,
      kind: ReportCardDefinitionKind.Default,
      status: mapDefinitionStatus(definition.mockStatus),
      isDefault: definition.isDefault,
      description: definition.name,
    })

    for (const section of definition.sections) {
      await service.createReportCardDefinitionSection({
        id: section.id,
        reportCardDefinitionId: definition.id,
        name: section.name,
        kind: ReportCardDefinitionSectionKind.Group,
        role: SEED_SECTION_ROLE_BY_KIND[section.mockKind],
        coefficient: 'mockCoefficient' in section ? section.mockCoefficient : undefined,
        order: section.order,
        weight: section.weight > 0 ? section.weight : 1,
      })
      sectionCount += 1

      for (const subjectId of section.subjectIds) {
        await service.createReportCardDefinitionSection({
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

  for (const result of SEED_REPORT_CARD_RESULTS) {
    await service.generateReportCardResult({
      id: result.id,
      studentId: result.studentId,
      periodId: result.periodId,
      reportCardDefinitionId: result.definitionId,
      generatedAt: parseSeedDate(result.generatedAt),
    })

    if (result.mockStatus === 'published' && result.publishedAt) {
      await service.publishReportCardResult({
        id: result.id,
        studentId: result.studentId,
        periodId: result.periodId,
        reportCardDefinitionId: result.definitionId,
        publishedAt: parseSeedDate(result.publishedAt),
      })
    }
  }

  return {
    gradeScales: SEED_GRADE_SCALES.length,
    definitions: SEED_REPORT_CARD_DEFINITIONS.length,
    sections: sectionCount,
    results: SEED_REPORT_CARD_RESULTS.length,
  }
}
