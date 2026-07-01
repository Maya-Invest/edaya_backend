import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/core";
import {
  GradeScale,
  ReportCardDefinitionKind,
  ReportCardDefinitionSectionKind,
  ReportCardDefinitionSectionRole,
  ReportCardDefinitionStatus,
} from "@edaya/core";
import { randomUUID } from "node:crypto";
import type {
  StructureTemplateCurriculumEntry,
  StructureTemplateDefinition,
  StructureTemplateReportCardStructure,
} from "./templates/types";

export interface AppliedStructureLevelSubjects {
  template: StructureTemplateDefinition;
  levelCode: string;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelShortLabel: string;
  subjects: Array<{
    subjectId: string;
    subjectCode: string;
    domain: string;
  }>;
}

export interface ApplyReportCardsFromTemplateInput {
  schoolId: string;
  academicYearId: string;
  levels: AppliedStructureLevelSubjects[];
}

export interface ApplyReportCardsFromTemplateResult {
  gradeScaleCount: number;
  reportCardDefinitionCount: number;
  reportCardSectionCount: number;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildGradeScaleRanges(maxScore: number, passingGrade: number) {
  const failMax = roundTo2(Math.max(0, passingGrade - 0.01));
  const span = maxScore - passingGrade;
  const step = span / 3;
  const band1Max = roundTo2(passingGrade + step - 0.01);
  const band2Max = roundTo2(passingGrade + step * 2 - 0.01);

  return [
    {
      letter: "D",
      minScore: 0,
      maxScore: failMax,
      isPassing: false,
      interpretation: "Insuffisant",
    },
    {
      letter: "C",
      minScore: passingGrade,
      maxScore: band1Max,
      isPassing: true,
      interpretation: "Passable",
    },
    {
      letter: "B",
      minScore: roundTo2(passingGrade + step),
      maxScore: band2Max,
      isPassing: true,
      interpretation: "Bien",
    },
    {
      letter: "A",
      minScore: roundTo2(passingGrade + step * 2),
      maxScore: maxScore,
      isPassing: true,
      interpretation: "Très bien",
    },
  ];
}

function periodLabel(structure: StructureTemplateReportCardStructure): string {
  const firstPeriod = structure.periods[0]?.name.toLowerCase() ?? "";
  if (firstPeriod.includes("semestre")) {
    return "semestriel";
  }
  return "trimestriel";
}

async function ensureGradeScale(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
  template: StructureTemplateDefinition,
  structure: StructureTemplateReportCardStructure,
  gradeScaleByTemplateId: Map<string, string>,
): Promise<string> {
  const existing = gradeScaleByTemplateId.get(template.id);
  if (existing) {
    return existing;
  }

  const service = application.forActor(actor);
  const gradeScaleId = randomUUID();
  await service.assessmentsWorkflow.createGradeScale(new GradeScale({
    id: gradeScaleId,
    schoolId: actor.schoolId!,
    name: `Sur ${structure.gradingScale}`,
    minScore: 0,
    maxScore: structure.gradingScale,
    decimalPlaces: structure.gradingScale <= 10 ? 1 : 2,
    description: `Barème ${structure.gradingScale} — seuil de réussite à ${structure.passingGrade}.`,
    isDefault: gradeScaleByTemplateId.size === 0,
    ranges: buildGradeScaleRanges(structure.gradingScale, structure.passingGrade),
  }));

  gradeScaleByTemplateId.set(template.id, gradeScaleId);
  return gradeScaleId;
}

function subjectsByDomain(
  level: AppliedStructureLevelSubjects,
  structure: StructureTemplateReportCardStructure,
): Map<string, AppliedStructureLevelSubjects["subjects"]> {
  const grouped = new Map<string, AppliedStructureLevelSubjects["subjects"]>();

  for (const category of [...structure.domainCategories].sort((a, b) => a.order - b.order)) {
    grouped.set(category.domain, []);
  }

  for (const subject of level.subjects) {
    const bucket = grouped.get(subject.domain);
    if (bucket) {
      bucket.push(subject);
    }
  }

  return grouped;
}

export async function applyReportCardsFromTemplate(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
  input: ApplyReportCardsFromTemplateInput,
): Promise<ApplyReportCardsFromTemplateResult> {
  const service = application.forActor(actor);
  const gradeScaleByTemplateId = new Map<string, string>();
  let reportCardDefinitionCount = 0;
  let reportCardSectionCount = 0;

  for (const level of input.levels) {
    const structure = level.template.reportCardStructure;
    if (!structure) {
      continue;
    }

    const gradeScaleId = await ensureGradeScale(
      application,
      actor,
      level.template,
      structure,
      gradeScaleByTemplateId,
    );

    const definitionId = randomUUID();
    reportCardDefinitionCount += 1;

    await service.assessmentsWorkflow.createReportCardDefinition({
      id: definitionId,
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      gradeLevelId: level.gradeLevelId,
      gradeScaleId,
      name: `Bulletin ${periodLabel(structure)} — ${level.gradeLevelName}`,
      kind: ReportCardDefinitionKind.Default,
      status: ReportCardDefinitionStatus.Published,
      isDefault: true,
      description: `Modèle de bulletin ${periodLabel(structure)} pour ${level.gradeLevelShortLabel}.`,
    });

    const groupedSubjects = subjectsByDomain(level, structure);
    let sectionOrder = 1;

    for (const category of [...structure.domainCategories].sort((a, b) => a.order - b.order)) {
      const domainSubjects = groupedSubjects.get(category.domain) ?? [];
      if (domainSubjects.length === 0) {
        continue;
      }

      const groupSectionId = randomUUID();
      reportCardSectionCount += 1;

      await service.assessmentsWorkflow.createReportCardDefinitionSection({
        id: groupSectionId,
        reportCardDefinitionId: definitionId,
        name: category.label,
        kind: ReportCardDefinitionSectionKind.Group,
        role: ReportCardDefinitionSectionRole.Subjects,
        coefficient: category.coefficient ?? 1,
        order: sectionOrder,
        weight: category.weight ?? domainSubjects.length,
      });
      sectionOrder += 1;

      for (const [subjectIndex, subject] of domainSubjects.entries()) {
        reportCardSectionCount += 1;
        await service.assessmentsWorkflow.createReportCardDefinitionSection({
          id: randomUUID(),
          reportCardDefinitionId: definitionId,
          name: subject.subjectCode,
          kind: ReportCardDefinitionSectionKind.Subject,
          order: subjectIndex + 1,
          weight: 1,
          parentSectionId: groupSectionId,
          subjectId: subject.subjectId,
        });
      }
    }

    if (structure.includeSummary !== false) {
      reportCardSectionCount += 1;
      await service.assessmentsWorkflow.createReportCardDefinitionSection({
        id: randomUUID(),
        reportCardDefinitionId: definitionId,
        name: structure.periods.length > 2 ? "Synthèse trimestrielle" : "Synthèse semestrielle",
        kind: ReportCardDefinitionSectionKind.Group,
        role: ReportCardDefinitionSectionRole.Summary,
        order: sectionOrder,
        weight: 1,
      });
      sectionOrder += 1;
    }

    if (structure.includeComments !== false) {
      reportCardSectionCount += 1;
      await service.assessmentsWorkflow.createReportCardDefinitionSection({
        id: randomUUID(),
        reportCardDefinitionId: definitionId,
        name: "Appréciations",
        kind: ReportCardDefinitionSectionKind.Group,
        role: ReportCardDefinitionSectionRole.Comments,
        order: sectionOrder,
        weight: 1,
      });
    }
  }

  return {
    gradeScaleCount: gradeScaleByTemplateId.size,
    reportCardDefinitionCount,
    reportCardSectionCount,
  };
}

export function collectLevelSubjects(
  template: StructureTemplateDefinition,
  levelCode: string,
  entries: StructureTemplateCurriculumEntry[],
  resolveSubjectId: (entry: StructureTemplateCurriculumEntry) => string | undefined,
): AppliedStructureLevelSubjects["subjects"] {
  const subjects: AppliedStructureLevelSubjects["subjects"] = [];

  for (const entry of entries) {
    const subjectId = resolveSubjectId(entry);
    const subject = template.subjects.find(item => item.code === entry.subjectCode);
    if (!subjectId || !subject) {
      continue;
    }
    subjects.push({
      subjectId,
      subjectCode: subject.code,
      domain: subject.domain,
    });
  }

  return subjects;
}
