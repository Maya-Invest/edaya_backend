import type { AnySchema, ObjectSchema } from "@/validation/utils/schema-fields";
import type { ConfigCommandEntityName } from "@/lib/service-accessors";
import {
  disciplinaryActionConfigCommandSchema,
  gradeLevelConfigCommandSchema,
  periodDefinitionConfigCommandSchema,
  resourceConfigCommandSchema,
  subjectConfigCommandSchema,
  subjectMatterConfigCommandSchema,
} from "@/validation/commands.schemas";
import {
  DisciplinaryAction,
  GradeLevel,
  PeriodDefinition,
  Resource,
  Subject,
  SubjectMatter,
} from "@edaya/core";
import * as schemas from "../../validation/entities.schemas";

export interface ConfigCommandEntity {
  name: ConfigCommandEntityName;
  displayName: string;
  requestSchema: ObjectSchema;
  responseSchema: AnySchema;
  createEntity: (body: Record<string, unknown>, schoolId: string) => unknown;
}

function withSchoolId(body: Record<string, unknown>, schoolId: string) {
  return {
    ...body,
    schoolId,
  };
}

export const configCommandEntities = [
  {
    name: "gradeLevels",
    displayName: "Grade Levels",
    requestSchema: gradeLevelConfigCommandSchema,
    responseSchema: schemas.gradeLevelResponseSchema,
    createEntity: (body, schoolId) => new GradeLevel(withSchoolId(body, schoolId) as ConstructorParameters<typeof GradeLevel>[0]),
  },
  {
    name: "periodDefinitions",
    displayName: "Period Definitions",
    requestSchema: periodDefinitionConfigCommandSchema,
    responseSchema: schemas.periodDefinitionResponseSchema,
    createEntity: (body, schoolId) => new PeriodDefinition(withSchoolId(body, schoolId) as ConstructorParameters<typeof PeriodDefinition>[0]),
  },
  {
    name: "resources",
    displayName: "Resources",
    requestSchema: resourceConfigCommandSchema,
    responseSchema: schemas.resourceResponseSchema,
    createEntity: (body, schoolId) => new Resource(withSchoolId(body, schoolId) as ConstructorParameters<typeof Resource>[0]),
  },
  {
    name: "subjects",
    displayName: "Subjects",
    requestSchema: subjectConfigCommandSchema,
    responseSchema: schemas.subjectResponseSchema,
    createEntity: (body, schoolId) => new Subject(withSchoolId(body, schoolId) as ConstructorParameters<typeof Subject>[0]),
  },
  {
    name: "subjectMatters",
    displayName: "Subject Matters",
    requestSchema: subjectMatterConfigCommandSchema,
    responseSchema: schemas.subjectMatterResponseSchema,
    createEntity: body => new SubjectMatter(body as unknown as ConstructorParameters<typeof SubjectMatter>[0]),
  },
  {
    name: "disciplinaryActions",
    displayName: "Disciplinary Actions",
    requestSchema: disciplinaryActionConfigCommandSchema,
    responseSchema: schemas.disciplinaryActionResponseSchema,
    createEntity: (body, schoolId) => new DisciplinaryAction(withSchoolId(body, schoolId) as ConstructorParameters<typeof DisciplinaryAction>[0]),
  },
] satisfies ConfigCommandEntity[];

export const configCommandEntitiesByName = new Map(
  configCommandEntities.map(entity => [entity.name, entity]),
);
