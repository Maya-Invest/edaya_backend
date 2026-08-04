import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/authorization";
import {
  ReportCardDefinitionKind,
  ReportCardDefinitionSection,
  ReportCardDefinitionSectionKind,
  ReportCardDefinitionSectionRole,
  ReportCardDefinitionStatus,
} from "@edaya/core";
import { randomUUID } from "node:crypto";
import type {
  StructureTemplateCurriculumEntry,
  StructureTemplateDefinition,
  StructureTemplateReportCardSection,
  StructureTemplateReportCardStructure,
} from "@edaya/fixtures/onboarding";

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
    coefficient: number;
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
      maxScore,
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
  await service.assessmentsWorkflow.createGradeScale({
    id: gradeScaleId,
    schoolId: actor.schoolId!,
    name: `Sur ${structure.gradingScale}`,
    minScore: 0,
    maxScore: structure.gradingScale,
    decimalPlaces: structure.gradingScale <= 10 ? 1 : 2,
    description: `Barème ${structure.gradingScale} — seuil de réussite à ${structure.passingGrade}.`,
    isDefault: gradeScaleByTemplateId.size === 0,
    ranges: buildGradeScaleRanges(structure.gradingScale, structure.passingGrade),
  });

  gradeScaleByTemplateId.set(template.id, gradeScaleId);
  return gradeScaleId;
}

function subjectsByDomain(
  level: AppliedStructureLevelSubjects,
  structure: StructureTemplateReportCardStructure,
): Map<string, AppliedStructureLevelSubjects["subjects"]> {
  const grouped = new Map<string, AppliedStructureLevelSubjects["subjects"]>();

  for (const category of [...(structure.domainCategories ?? [])].sort((a, b) => a.order - b.order)) {
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

function subjectByCode(
  level: AppliedStructureLevelSubjects,
): Map<string, AppliedStructureLevelSubjects["subjects"][number]> {
  return new Map(level.subjects.map(subject => [subject.subjectCode, subject]));
}

function pushSubjectChildren(
  sections: ReportCardDefinitionSection[],
  definitionId: string,
  parentSectionId: string,
  subjects: AppliedStructureLevelSubjects["subjects"],
): number {
  for (const [subjectIndex, subject] of subjects.entries()) {
    sections.push(new ReportCardDefinitionSection({
      id: randomUUID(),
      reportCardDefinitionId: definitionId,
      name: subject.subjectCode,
      kind: ReportCardDefinitionSectionKind.Subject,
      order: subjectIndex + 1,
      weight: subject.coefficient > 0 ? subject.coefficient : 1,
      parentSectionId,
      subjectId: subject.subjectId,
    }));
  }
  return subjects.length;
}

function buildSectionsFromTemplate(
  level: AppliedStructureLevelSubjects,
  structure: StructureTemplateReportCardStructure,
  definitionId: string,
  templateSections: StructureTemplateReportCardSection[],
): ReportCardDefinitionSection[] {
  const byCode = subjectByCode(level);
  const assigned = new Set<string>();
  let sectionOrder = 1;
  const sections: ReportCardDefinitionSection[] = [];
  const autresSection = templateSections.find(
    section => section.role === "subjects" && section.label.toLowerCase().includes("autres"),
  );

  for (const section of [...templateSections].sort((a, b) => a.order - b.order)) {
    if (section.role === "subjects") {
      const orderedCodes = section.subjectCodes ?? [];
      const members = orderedCodes
        .map(code => byCode.get(code))
        .filter((subject): subject is AppliedStructureLevelSubjects["subjects"][number] => Boolean(subject));

      for (const member of members) {
        assigned.add(member.subjectCode);
      }

      if (autresSection && section.label === autresSection.label) {
        for (const subject of level.subjects) {
          if (!assigned.has(subject.subjectCode)) {
            members.push(subject);
            assigned.add(subject.subjectCode);
          }
        }
      }

      if (members.length === 0) {
        continue;
      }

      const groupSectionId = randomUUID();
      sections.push(new ReportCardDefinitionSection({
        id: groupSectionId,
        reportCardDefinitionId: definitionId,
        name: section.label,
        kind: ReportCardDefinitionSectionKind.Group,
        role: ReportCardDefinitionSectionRole.Subjects,
        coefficient: 1,
        order: sectionOrder,
        weight: members.reduce((sum, subject) => sum + subject.coefficient, 0) || members.length,
      }));
      sectionOrder += 1;
      pushSubjectChildren(sections, definitionId, groupSectionId, members);
      continue;
    }

    if (section.role === "summary") {
      sections.push(new ReportCardDefinitionSection({
        id: randomUUID(),
        reportCardDefinitionId: definitionId,
        name: section.label,
        kind: ReportCardDefinitionSectionKind.Group,
        role: ReportCardDefinitionSectionRole.Summary,
        order: sectionOrder,
        weight: 1,
      }));
      sectionOrder += 1;
      continue;
    }

    if (section.role === "comments") {
      sections.push(new ReportCardDefinitionSection({
        id: randomUUID(),
        reportCardDefinitionId: definitionId,
        name: section.label,
        kind: ReportCardDefinitionSectionKind.Group,
        role: ReportCardDefinitionSectionRole.Comments,
        order: sectionOrder,
        weight: 1,
      }));
      sectionOrder += 1;
    }
  }

  if (!autresSection) {
    const leftovers = level.subjects.filter(subject => !assigned.has(subject.subjectCode));
    for (const subject of leftovers) {
      sections.push(new ReportCardDefinitionSection({
        id: randomUUID(),
        reportCardDefinitionId: definitionId,
        name: subject.subjectCode,
        kind: ReportCardDefinitionSectionKind.Subject,
        order: sectionOrder,
        weight: subject.coefficient > 0 ? subject.coefficient : 1,
        subjectId: subject.subjectId,
      }));
      sectionOrder += 1;
    }
  }

  return sections;
}

function buildDomainCategoriesFallbackSections(
  level: AppliedStructureLevelSubjects,
  structure: StructureTemplateReportCardStructure,
  definitionId: string,
): ReportCardDefinitionSection[] {
  const groupedSubjects = subjectsByDomain(level, structure);
  let sectionOrder = 1;
  const sections: ReportCardDefinitionSection[] = [];

  for (const category of [...(structure.domainCategories ?? [])].sort((a, b) => a.order - b.order)) {
    const domainSubjects = groupedSubjects.get(category.domain) ?? [];
    if (domainSubjects.length === 0) {
      continue;
    }

    const groupSectionId = randomUUID();
    sections.push(new ReportCardDefinitionSection({
      id: groupSectionId,
      reportCardDefinitionId: definitionId,
      name: category.label,
      kind: ReportCardDefinitionSectionKind.Group,
      role: ReportCardDefinitionSectionRole.Subjects,
      coefficient: category.coefficient ?? 1,
      order: sectionOrder,
      weight: category.weight ?? domainSubjects.length,
    }));
    sectionOrder += 1;
    pushSubjectChildren(sections, definitionId, groupSectionId, domainSubjects);
  }

  if (structure.includeSummary !== false) {
    sections.push(new ReportCardDefinitionSection({
      id: randomUUID(),
      reportCardDefinitionId: definitionId,
      name: structure.periods.length > 2 ? "Synthèse trimestrielle" : "Synthèse semestrielle",
      kind: ReportCardDefinitionSectionKind.Group,
      role: ReportCardDefinitionSectionRole.Summary,
      order: sectionOrder,
      weight: 1,
    }));
    sectionOrder += 1;
  }

  if (structure.includeComments !== false) {
    sections.push(new ReportCardDefinitionSection({
      id: randomUUID(),
      reportCardDefinitionId: definitionId,
      name: "Appréciations",
      kind: ReportCardDefinitionSectionKind.Group,
      role: ReportCardDefinitionSectionRole.Comments,
      order: sectionOrder,
      weight: 1,
    }));
  }

  return sections;
}

export async function applyReportCardsFromTemplate(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
  input: ApplyReportCardsFromTemplateInput,
): Promise<ApplyReportCardsFromTemplateResult> {
  const service = application.forActor(actor);
  const gradeScaleByTemplateId = new Map<string, string>();
  let reportCardDefinitionCount = 0;
  const allSections: ReportCardDefinitionSection[] = [];

  for (const level of input.levels) {
    const gradeLevel = level.template.gradeLevels.find(entry => entry.code === level.levelCode);
    const structure = gradeLevel?.reportCardStructure ?? level.template.reportCardStructure;
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

    if (structure.sections?.length) {
      allSections.push(...buildSectionsFromTemplate(
        level,
        structure,
        definitionId,
        structure.sections,
      ));
    }
    else {
      allSections.push(...buildDomainCategoriesFallbackSections(
        level,
        structure,
        definitionId,
      ));
    }
  }

  if (allSections.length > 0) {
    await application.repositories.sections.batchSave(allSections);
  }

  return {
    gradeScaleCount: gradeScaleByTemplateId.size,
    reportCardDefinitionCount,
    reportCardSectionCount: allSections.length,
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
      coefficient: entry.coefficient,
    });
  }

  return subjects;
}
