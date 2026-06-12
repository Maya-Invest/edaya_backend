import type { ApiSchoolApplication } from "@/lib/school-api/application";
import {
  parseSeedDate,
  SEED_ACADEMIC_YEAR_ID,
  SEED_GRADE_SCALES,
  SEED_REPORT_CARD_DEFINITIONS,
  SEED_REPORT_CARD_RESULTS,
  SEED_SCHOOL_ID,
} from "@edaya/dev-fixtures";
import type { SchoolService } from "@edaya/core";
import {
  AttendanceSummary,
  ReportCardDefinitionKind,
  ReportCardDefinitionSectionKind,
  ReportCardDefinitionSectionRole,
  ReportCardDefinitionStatus,
  ReportCardResult,
  ReportCardResultSection,
  ReportCardResultStatus,
} from "@edaya/core";

const SEED_SECTION_ROLE_BY_KIND = {
  matieres: ReportCardDefinitionSectionRole.Subjects,
  synthese: ReportCardDefinitionSectionRole.Summary,
  appreciation: ReportCardDefinitionSectionRole.Comments,
} as const;

function mapDefinitionStatus(mockStatus: "published" | "draft"): ReportCardDefinitionStatus {
  return mockStatus === "published"
    ? ReportCardDefinitionStatus.Published
    : ReportCardDefinitionStatus.Draft;
}

const CLASS_SUBJECT_BY_SUBJECT: Record<string, string> = {
  "subj-math": "cs-6a-math",
  "subj-fr": "cs-6a-fr",
  "subj-hist": "cs-6a-hist",
  "subj-sci": "cs-6a-sci",
  "subj-en": "cs-6a-en",
  "subj-eps": "cs-6a-eps",
  "subj-advmath": "cs-term-advmath",
  "subj-phys": "cs-term-phys",
};

function mapResultStatus(mockStatus: "published" | "generated"): ReportCardResultStatus {
  return mockStatus === "published"
    ? ReportCardResultStatus.Published
    : ReportCardResultStatus.Draft;
}

function buildSectionResults(
  definition: (typeof SEED_REPORT_CARD_DEFINITIONS)[number],
  sectionMarks: Record<string, readonly {
    subjectId: string;
    average: number;
    coefficient: number;
    appreciation: string;
  }[]>,
): ReportCardResultSection[] {
  return definition.sections
    .filter(section => section.mockKind === "matieres")
    .map((section) => {
      const marks = sectionMarks[section.id] ?? [];
      const subResults = marks.map(mark => new ReportCardResultSection({
        sectionId: `${section.id}-${mark.subjectId}`,
        sectionKind: ReportCardDefinitionSectionKind.Subject,
        name: mark.subjectId,
        average: mark.average,
        weight: mark.coefficient,
        comment: mark.appreciation,
        parentSectionId: section.id,
        classSubjectId: CLASS_SUBJECT_BY_SUBJECT[mark.subjectId],
        subResults: [],
      }));
      const sectionAverage = marks.length > 0
        ? Math.round(marks.reduce((sum, mark) => sum + mark.average * mark.coefficient, 0)
          / marks.reduce((sum, mark) => sum + mark.coefficient, 0))
        : 0;

      return new ReportCardResultSection({
        sectionId: section.id,
        sectionKind: ReportCardDefinitionSectionKind.Group,
        name: section.name,
        average: sectionAverage,
        weight: section.weight,
        subResults,
      });
    });
}

export async function seedReportCards(
  application: ApiSchoolApplication,
  service: SchoolService,
): Promise<{ gradeScales: number; definitions: number; sections: number; results: number }> {
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
    });
  }

  let sectionCount = 0;

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
    });

    for (const section of definition.sections) {
      await service.createReportCardDefinitionSection({
        id: section.id,
        reportCardDefinitionId: definition.id,
        name: section.name,
        kind: ReportCardDefinitionSectionKind.Group,
        role: SEED_SECTION_ROLE_BY_KIND[section.mockKind],
        coefficient: "mockCoefficient" in section ? section.mockCoefficient : undefined,
        order: section.order,
        weight: section.weight > 0 ? section.weight : 1,
      });
      sectionCount += 1;

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
        });
        sectionCount += 1;
      }
    }
  }

  for (const result of SEED_REPORT_CARD_RESULTS) {
    const definition = SEED_REPORT_CARD_DEFINITIONS.find(entry => entry.id === result.definitionId);
    if (!definition) {
      continue;
    }

    const status = mapResultStatus(result.mockStatus);
    await application.repositories.results.save(new ReportCardResult({
      id: result.id,
      reportCardDefinitionId: result.definitionId,
      studentId: result.studentId,
      classGroupId: result.classGroupId,
      periodId: result.periodId,
      attendanceSummary: new AttendanceSummary({
        presentCount: 0,
        absenceCount: 0,
        excusedAbsenceCount: 0,
        lateCount: 0,
      }),
      assessmentResultCount: 0,
      overallAverage: Math.round(result.overallAverage),
      rank: result.classRank,
      classSize: result.classSize,
      teacherComment: result.homeroomComment,
      principalComment: "principalComment" in result ? result.principalComment : undefined,
      status,
      generatedAt: parseSeedDate(result.generatedAt),
      publishedAt: "publishedAt" in result ? parseSeedDate(result.publishedAt) : undefined,
      sectionResults: buildSectionResults(definition, result.sectionMarks),
    }));
  }

  return {
    gradeScales: SEED_GRADE_SCALES.length,
    definitions: SEED_REPORT_CARD_DEFINITIONS.length,
    sections: sectionCount,
    results: SEED_REPORT_CARD_RESULTS.length,
  };
}
