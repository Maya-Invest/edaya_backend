import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/core";
import {
  BusinessRuleViolationError,
  ClassSubjectMatterStatus,
  GradeLevel,
  Subject,
  SubjectCategory,
  SubjectColor,
  SubjectMatter,
} from "@edaya/core";
import { randomUUID } from "node:crypto";
import {
  BASE_SUBJECT_TEMPLATES,
  classDisplayName,
  GRADE_LEVEL_TEMPLATES,
  type GradeLevelTemplateKey,
  isGradeLevelTemplateKey,
  type StructureModel,
  type SubjectTemplate,
} from "./structure-templates";

export interface ApplyStructureLevelInput {
  gradeLevelId: GradeLevelTemplateKey;
  classCount: number;
  capacity: number;
}

export interface ApplyStructureTemplateInput {
  models: StructureModel[];
  levels: ApplyStructureLevelInput[];
}

export interface ApplyStructureTemplateResult {
  gradeLevelCount: number;
  classGroupCount: number;
  subjectCount: number;
  classSubjectCount: number;
}

const SUBJECT_CATEGORY_BY_KEY: Record<SubjectTemplate["category"], SubjectCategory> = {
  "Scientifique": SubjectCategory.Scientific,
  "Littéraire": SubjectCategory.Literary,
  "Langues": SubjectCategory.Languages,
  "Sciences humaines": SubjectCategory.Humanities,
  "Sport": SubjectCategory.Sport,
};

const SUBJECT_COLOR_BY_KEY: Record<SubjectTemplate["color"], SubjectColor> = {
  mint: SubjectColor.Mint,
  sky: SubjectColor.Sky,
  warm: SubjectColor.Warm,
};

function parseStructureInput(input: ApplyStructureTemplateInput): ApplyStructureLevelInput[] {
  if (!input.models.length) {
    throw new BusinessRuleViolationError(
      "STRUCTURE_MODEL_REQUIRED",
      "At least one school model must be selected",
    );
  }

  const allowed = new Set(
    input.models.flatMap(model =>
      model === "college"
        ? ["gl-6", "gl-5", "gl-4", "gl-3"]
        : ["gl-2", "gl-1", "gl-t"],
    ),
  );

  const normalized: ApplyStructureLevelInput[] = [];
  for (const level of input.levels) {
    if (!isGradeLevelTemplateKey(level.gradeLevelId) || !allowed.has(level.gradeLevelId)) {
      throw new BusinessRuleViolationError(
        "STRUCTURE_LEVEL_NOT_ALLOWED",
        `Grade level ${level.gradeLevelId} is not allowed for the selected models`,
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
    normalized.push(level);
  }

  if (!normalized.length) {
    throw new BusinessRuleViolationError(
      "STRUCTURE_LEVEL_REQUIRED",
      "At least one grade level must be configured",
    );
  }

  return normalized;
}

export async function applyStructureTemplate(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
  input: ApplyStructureTemplateInput,
): Promise<ApplyStructureTemplateResult> {
  const levels = parseStructureInput(input);
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

  await service.baseService.atomicExecution.execute(async () => {
    const subjectIds = new Map<string, string>();
    const matterIds = new Map<string, string>();

    for (const template of BASE_SUBJECT_TEMPLATES) {
      const subjectId = randomUUID();
      const matterId = randomUUID();
      subjectIds.set(template.key, subjectId);
      matterIds.set(template.key, matterId);

      await service.baseService.entities.subjects.save(new Subject({
        id: subjectId,
        schoolId,
        name: template.name,
        code: template.code,
        defaultCoefficient: template.defaultCoefficient,
        category: SUBJECT_CATEGORY_BY_KEY[template.category],
        color: SUBJECT_COLOR_BY_KEY[template.color],
      }), { moduleChecked: true });

      await service.baseService.entities.subjectMatters.save(new SubjectMatter({
        id: matterId,
        subjectId,
        name: template.matterName,
        description: template.matterDescription,
        sequenceOrder: 1,
        estimatedHours: template.estimatedHours,
      }), { moduleChecked: true });
    }

    for (const level of levels) {
      const template = GRADE_LEVEL_TEMPLATES[level.gradeLevelId];
      const gradeLevelId = randomUUID();
      gradeLevelCount += 1;

      await service.baseService.entities.gradeLevels.save(new GradeLevel({
        id: gradeLevelId,
        schoolId,
        name: template.name,
        order: template.order,
        cycle: template.cycle,
      }), { moduleChecked: true });

      for (let index = 0; index < level.classCount; index += 1) {
        const classGroupId = randomUUID();
        classGroupCount += 1;

        await service.setupWorkflow.createClassGroup({
          id: classGroupId,
          schoolId,
          academicYearId: academicYear.id,
          gradeLevelId,
          name: classDisplayName(level.gradeLevelId, index),
          capacity: level.capacity,
        });

        for (const subjectTemplate of BASE_SUBJECT_TEMPLATES) {
          const subjectId = subjectIds.get(subjectTemplate.key)!;
          const matterId = matterIds.get(subjectTemplate.key)!;
          const classSubjectId = randomUUID();

          await service.academicsWorkflow.offerSubjectToClass({
            id: classSubjectId,
            classGroupId,
            subjectId,
            coefficient: subjectTemplate.defaultCoefficient,
          });

          await service.academicsWorkflow.assignMatterToClassSubject({
            id: randomUUID(),
            classSubjectId,
            subjectMatterId: matterId,
            status: ClassSubjectMatterStatus.NotStarted,
            completedPercentage: 0,
          });

          classSubjectCount += 1;
        }
      }
    }
  });

  return {
    gradeLevelCount,
    classGroupCount,
    subjectCount: BASE_SUBJECT_TEMPLATES.length,
    classSubjectCount,
  };
}
