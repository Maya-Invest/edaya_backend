import type { ApiSchoolApplication } from "@/lib/school-api/application";
import {
  parseSeedDate,
  SEED_ACADEMIC_YEAR_ID,
  SEED_GRADE_SCALES,
  SEED_REPORT_CARD_DEFINITION_MS6,
  SEED_REPORT_CARD_RESULTS_6A,
  SEED_SCHOOL_ID,
} from "@edaya/dev-fixtures";
import type { SchoolService } from "@edaya/core";
import {
  AttendanceSummary,
  ReportCardDefinitionKind,
  ReportCardDefinitionSectionKind,
  ReportCardResult,
  ReportCardResultSection,
  ReportCardResultStatus,
} from "@edaya/core";

const CLASS_SUBJECT_BY_SUBJECT: Record<string, string> = {
  "subj-math": "cs-6a-math",
  "subj-fr": "cs-6a-fr",
  "subj-hist": "cs-6a-hist",
  "subj-sci": "cs-6a-sci",
  "subj-en": "cs-6a-en",
  "subj-eps": "cs-6a-eps",
};

function mapResultStatus(mockStatus: "published" | "generated"): ReportCardResultStatus {
  return mockStatus === "published"
    ? ReportCardResultStatus.Published
    : ReportCardResultStatus.Draft;
}

function buildSectionResults(
  sectionMarks: Record<string, readonly {
    subjectId: string;
    average: number;
    coefficient: number;
    appreciation: string;
  }[]>,
): ReportCardResultSection[] {
  return SEED_REPORT_CARD_DEFINITION_MS6.sections
    .filter(section => section.mockKind === "matieres")
    .map((section) => {
      const marks = sectionMarks[section.id] ?? [];
      const subResults = marks.map(mark => new ReportCardResultSection({
        sectionId: `${section.id}-${mark.subjectId}`,
        sectionKind: ReportCardDefinitionSectionKind.Subject,
        name: mark.subjectId,
        average: Math.round(mark.average),
        weight: Math.max(1, Math.round(mark.coefficient)),
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
      isDefault: scale.isDefault,
      ranges: [...scale.ranges],
    });
  }

  await service.createReportCardDefinition({
    id: SEED_REPORT_CARD_DEFINITION_MS6.id,
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    gradeLevelId: SEED_REPORT_CARD_DEFINITION_MS6.gradeLevelId,
    name: SEED_REPORT_CARD_DEFINITION_MS6.name,
    kind: ReportCardDefinitionKind.Default,
    isDefault: SEED_REPORT_CARD_DEFINITION_MS6.isDefault,
    description: "Bulletin trimestriel collège 6ème",
  });

  let sectionCount = 0;
  for (const section of SEED_REPORT_CARD_DEFINITION_MS6.sections) {
    await service.createReportCardDefinitionSection({
      id: section.id,
      reportCardDefinitionId: SEED_REPORT_CARD_DEFINITION_MS6.id,
      name: section.name,
      kind: ReportCardDefinitionSectionKind.Group,
      order: section.order,
      weight: section.weight > 0 ? section.weight : 1,
    });
    sectionCount += 1;

    for (const subjectId of section.subjectIds) {
      await service.createReportCardDefinitionSection({
        id: `${section.id}-${subjectId}`,
        reportCardDefinitionId: SEED_REPORT_CARD_DEFINITION_MS6.id,
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

  for (const result of SEED_REPORT_CARD_RESULTS_6A) {
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
      sectionResults: buildSectionResults(result.sectionMarks),
    }));
  }

  return {
    gradeScales: SEED_GRADE_SCALES.length,
    definitions: 1,
    sections: sectionCount,
    results: SEED_REPORT_CARD_RESULTS_6A.length,
  };
}
