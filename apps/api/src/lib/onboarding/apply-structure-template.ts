import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/authorization";
import { BusinessRuleViolationError, GradeLevel, Subject, SubjectCategory, SubjectColor, SubjectMatter } from "@edaya/core";
import { randomUUID } from "node:crypto";
import {
  classDisplayName,
  nextOnboardingClassGroupId,
  onboardingWizardClassDisplayName,
  onboardingWizardGradeLevelLabels,
  parseGradeLevelTemplateId,
  resolveStructureTemplates,
  structureGradeLevelSeedId,
} from "@edaya/fixtures/onboarding";
import type {
  StructureTemplateCurriculumEntry,
  StructureTemplateDefinition,
  StructureTemplateId,
} from "@edaya/fixtures/onboarding";
import {

  applyReportCardsFromTemplate,
  collectLevelSubjects,
} from "./apply-report-cards-from-template";
import type { AppliedStructureLevelSubjects } from "./apply-report-cards-from-template";
import { ensureAcademicPeriodsFromTemplates } from "./ensure-academic-periods-from-template";

export interface ApplyStructureLevelInput {
  gradeLevelId: string;
  classCount: number;
  capacity: number;
}

export interface ApplyStructureTemplateInput {
  templates: StructureTemplateId[];
  templateSnapshots?: StructureTemplateDefinition[];
  levels: ApplyStructureLevelInput[];
}

export interface ApplyStructureTemplateResult {
  gradeLevelCount: number;
  classGroupCount: number;
  subjectCount: number;
  classSubjectCount: number;
  gradeScaleCount: number;
  reportCardDefinitionCount: number;
  reportCardSectionCount: number;
}

const DOMAIN_TO_CATEGORY: Record<string, SubjectCategory> = {
  "Sciences": SubjectCategory.Scientific,
  "Langues": SubjectCategory.Languages,
  "Univers Social": SubjectCategory.Humanities,
  "Arts": SubjectCategory.Arts,
  "Développement Physique": SubjectCategory.Sport,
};

const DOMAIN_TO_COLOR: Record<string, SubjectColor> = {
  "Sciences": SubjectColor.Mint,
  "Langues": SubjectColor.Sky,
  "Univers Social": SubjectColor.Warm,
  "Arts": SubjectColor.Warm,
  "Développement Physique": SubjectColor.Mint,
};

function subjectCategory(domain: string): SubjectCategory {
  return DOMAIN_TO_CATEGORY[domain] ?? SubjectCategory.Scientific;
}

function subjectColor(domain: string): SubjectColor {
  return DOMAIN_TO_COLOR[domain] ?? SubjectColor.Mint;
}

function catalogSubjectKey(entry: StructureTemplateCurriculumEntry): string {
  return entry.longName ?? `${entry.subjectCode}::${entry.levelCodes.join("/")}`;
}

function catalogSubjectName(
  subject: StructureTemplateDefinition["subjects"][number],
  entry: StructureTemplateCurriculumEntry,
): string {
  return entry.longName ?? subject.shortName;
}

function curriculumEntriesForLevel(
  template: StructureTemplateDefinition,
  levelCode: string,
): StructureTemplateCurriculumEntry[] {
  const specific = template.curriculum.filter(entry => entry.levelCodes.includes(levelCode));
  if (specific.length > 0) {
    return specific;
  }
  return template.subjects.map(subject => ({
    levelCodes: [],
    subjectCode: subject.code,
    coefficient: subject.defaultCoefficient,
    matters: ["Programme de base"],
  }));
}

function parseStructureInput(
  input: ApplyStructureTemplateInput,
  templates: StructureTemplateDefinition[],
): Array<ApplyStructureLevelInput & { template: StructureTemplateDefinition; levelCode: string }> {
  if (!input.templates.length) {
    throw new BusinessRuleViolationError(
      "STRUCTURE_TEMPLATE_REQUIRED",
      "At least one school template must be selected",
    );
  }

  const templateById = new Map(templates.map(template => [template.id, template]));
  const allowedLevelIds = new Set(
    templates.flatMap(template => template.gradeLevels.map(level => level.id)),
  );

  const normalized: Array<ApplyStructureLevelInput & { template: StructureTemplateDefinition; levelCode: string }> = [];
  for (const level of input.levels) {
    const parsed = parseGradeLevelTemplateId(level.gradeLevelId);
    if (!parsed || !allowedLevelIds.has(level.gradeLevelId)) {
      throw new BusinessRuleViolationError(
        "STRUCTURE_LEVEL_NOT_ALLOWED",
        `Grade level ${level.gradeLevelId} is not allowed for the selected templates`,
      );
    }
    const template = templateById.get(parsed.templateId);
    if (!template) {
      throw new BusinessRuleViolationError(
        "STRUCTURE_LEVEL_NOT_ALLOWED",
        `Template ${parsed.templateId} is not selected`,
      );
    }
    if (!Number.isInteger(level.classCount) || level.classCount < 1) {
      throw new BusinessRuleViolationError(
        "STRUCTURE_INVALID_CLASS_COUNT",
        "Each level must have at least one class",
      );
    }
    if (!Number.isInteger(level.capacity) || level.capacity < 1) {
      throw new BusinessRuleViolationError(
        "STRUCTURE_INVALID_CAPACITY",
        "Each class must have a positive capacity",
      );
    }
    normalized.push({
      ...level,
      template,
      levelCode: parsed.levelCode,
    });
  }

  if (!normalized.length) {
    throw new BusinessRuleViolationError(
      "STRUCTURE_LEVEL_REQUIRED",
      "At least one grade level must be configured",
    );
  }

  return normalized;
}

async function allocateUniqueId(
  preferredId: string,
  schoolId: string,
  findById: (id: string) => Promise<{ id: string; schoolId?: string } | undefined>,
): Promise<string> {
  const existing = await findById(preferredId);
  if (!existing) {
    return preferredId;
  }
  if (existing.schoolId === schoolId) {
    return preferredId;
  }
  return `${preferredId}--${schoolId.slice(0, 8)}`;
}

export async function applyStructureTemplate(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
  input: ApplyStructureTemplateInput,
): Promise<ApplyStructureTemplateResult> {
  const templates = resolveStructureTemplates(input.templates, input.templateSnapshots ?? []);
  const levels = parseStructureInput(input, templates);
  const schoolId = actor.schoolId;
  const service = application.forActor(actor);

  const existingLevels = await application.repositories.gradeLevels.list({ schoolId });
  if (existingLevels.length > 0) {
    throw new BusinessRuleViolationError(
      "STRUCTURE_ALREADY_CONFIGURED",
      "This school already has grade levels configured",
    );
  }

  const academicYears = await application.repositories.academicYears.list({ schoolId });
  const academicYear = academicYears.find(year => year.isActive) ?? academicYears[0];
  if (!academicYear) {
    throw new BusinessRuleViolationError(
      "NO_ACADEMIC_YEAR",
      "Create an academic year before applying the structure template",
    );
  }

  let gradeLevelCount = 0;
  let classGroupCount = 0;
  let classSubjectCount = 0;
  let subjectCount = 0;
  let gradeScaleCount = 0;
  let reportCardDefinitionCount = 0;
  let reportCardSectionCount = 0;

  const appliedLevels: AppliedStructureLevelSubjects[] = [];

  await service.baseService.atomicExecution.execute(async () => {
    const uniqueTemplates = [...new Map(levels.map(level => [level.template.id, level.template])).values()];
    await ensureAcademicPeriodsFromTemplates(application, actor, {
      schoolId,
      academicYearId: academicYear.id,
      academicYearStart: academicYear.startDate,
      academicYearEnd: academicYear.endDate,
      templates: uniqueTemplates,
    });

    const subjectIds = new Map<string, string>();
    const matterIdsByKey = new Map<string, string>();
    const usedClassGroupIds = new Set<string>();
    const classSiblingCountByGradeSeed = new Map<string, number>();

    async function ensureSubject(
      template: StructureTemplateDefinition,
      entry: StructureTemplateCurriculumEntry,
    ): Promise<string> {
      const catalogKey = catalogSubjectKey(entry);
      const existing = subjectIds.get(catalogKey);
      if (existing) {
        return existing;
      }
      const subject = template.subjects.find(item => item.code === entry.subjectCode);
      if (!subject) {
        throw new BusinessRuleViolationError(
          "STRUCTURE_SUBJECT_UNKNOWN",
          `Unknown subject code ${entry.subjectCode}`,
        );
      }
      const subjectId = randomUUID();
      subjectIds.set(catalogKey, subjectId);
      await service.baseService.entities.subjects.save(new Subject({
        id: subjectId,
        schoolId,
        name: catalogSubjectName(subject, entry),
        shortName: subject.shortName,
        code: subject.code,
        defaultCoefficient: entry.coefficient ?? subject.defaultCoefficient,
        category: subjectCategory(subject.domain),
        color: subjectColor(subject.domain),
      }), { moduleChecked: true });
      return subjectId;
    }

    async function ensureMatter(
      subjectId: string,
      matterName: string,
      sequenceOrder: number,
    ): Promise<string> {
      const key = `${subjectId}::${matterName}`;
      const existing = matterIdsByKey.get(key);
      if (existing) {
        return existing;
      }
      const matterId = randomUUID();
      matterIdsByKey.set(key, matterId);
      await service.baseService.entities.subjectMatters.save(new SubjectMatter({
        id: matterId,
        subjectId,
        name: matterName,
        description: matterName,
        sequenceOrder,
        estimatedHours: 2,
      }), { moduleChecked: true });
      return matterId;
    }

    for (const level of levels) {
      const gradeLevelDef = level.template.gradeLevels.find(entry => entry.code === level.levelCode);
      if (!gradeLevelDef) {
        continue;
      }

      const preferredGradeLevelId = structureGradeLevelSeedId(level.gradeLevelId);
      const gradeLevelId = await allocateUniqueId(
        preferredGradeLevelId,
        schoolId,
        id => application.repositories.gradeLevels.findById(id),
      );
      gradeLevelCount += 1;

      const wizardLabels = onboardingWizardGradeLevelLabels(level.gradeLevelId);
      const gradeLevelName = wizardLabels?.name ?? gradeLevelDef.name;
      const gradeLevelShortLabel = wizardLabels?.shortLabel ?? gradeLevelDef.shortLabel;

      await service.baseService.entities.gradeLevels.save(new GradeLevel({
        id: gradeLevelId,
        schoolId,
        name: gradeLevelName,
        order: gradeLevelDef.order,
        cycle: level.template.cycle,
      }), { moduleChecked: true });

      const entries = curriculumEntriesForLevel(level.template, level.levelCode);

      for (const entry of entries) {
        const subjectId = await ensureSubject(level.template, entry);
        const gradeLevelSubjectId = randomUUID();

        await service.academicsWorkflow.offerSubjectToGradeLevel({
          id: gradeLevelSubjectId,
          gradeLevelId,
          academicYearId: academicYear.id,
          subjectId,
          coefficient: entry.coefficient,
          isOptional: entry.isOptional,
        });

        for (const [matterIndex, matterName] of entry.matters.entries()) {
          const matterId = await ensureMatter(
            subjectId,
            matterName,
            matterIndex + 1,
          );
          await service.academicsWorkflow.assignMatterToGradeLevelSubject({
            id: randomUUID(),
            gradeLevelSubjectId,
            subjectMatterId: matterId,
            classSubjectMatterIdsByClassGroupId: undefined,
          });
        }

        classSubjectCount += level.classCount;
      }

      appliedLevels.push({
        template: level.template,
        levelCode: level.levelCode,
        gradeLevelId,
        gradeLevelName,
        gradeLevelShortLabel,
        subjects: collectLevelSubjects(
          level.template,
          level.levelCode,
          entries,
          entry => subjectIds.get(catalogSubjectKey(entry)),
        ),
      });

      for (let index = 0; index < level.classCount; index += 1) {
        const preferredClassGroupId = nextOnboardingClassGroupId(
          level.gradeLevelId,
          usedClassGroupIds,
          classSiblingCountByGradeSeed,
        );
        const classGroupId = await allocateUniqueId(
          preferredClassGroupId,
          schoolId,
          id => application.repositories.classGroups.findById(id),
        );
        usedClassGroupIds.add(classGroupId);
        classGroupCount += 1;

        await service.setupWorkflow.createClassGroup({
          id: classGroupId,
          schoolId,
          academicYearId: academicYear.id,
          gradeLevelId,
          name: onboardingWizardClassDisplayName(level.gradeLevelId, index)
            ?? classDisplayName(level.template, level.levelCode, index),
          capacity: level.capacity,
        });
      }
    }

    subjectCount = subjectIds.size;

    const reportCardCounts = await applyReportCardsFromTemplate(application, actor, {
      schoolId,
      academicYearId: academicYear.id,
      levels: appliedLevels,
    });
    gradeScaleCount = reportCardCounts.gradeScaleCount;
    reportCardDefinitionCount = reportCardCounts.reportCardDefinitionCount;
    reportCardSectionCount = reportCardCounts.reportCardSectionCount;
  });

  return {
    gradeLevelCount,
    classGroupCount,
    subjectCount,
    classSubjectCount,
    gradeScaleCount,
    reportCardDefinitionCount,
    reportCardSectionCount,
  };
}
