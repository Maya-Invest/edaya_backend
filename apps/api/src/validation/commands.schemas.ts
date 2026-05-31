import { DisciplinaryActionKind, ResourceKind } from "@edaya/core";
import { field, namedObjectSchema } from "./utils/schema-fields";

export const gradeLevelConfigCommandSchema = namedObjectSchema("GradeLevelConfigCommand", {
  id: field.id(),
  name: field.text(),
  order: field.positiveInt(),
  cycle: field.nullableText(),
  createdAt: field.optionalDate(),
});

export const periodDefinitionConfigCommandSchema = namedObjectSchema("PeriodDefinitionConfigCommand", {
  id: field.id(),
  academicYearId: field.id(),
  label: field.text(),
  order: field.positiveInt(),
  startTime: field.timeOfDay(),
  endTime: field.timeOfDay(),
  isBreak: field.optionalBoolean(),
  createdAt: field.optionalDate(),
});

export const resourceConfigCommandSchema = namedObjectSchema("ResourceConfigCommand", {
  id: field.id(),
  name: field.text(),
  description: field.nullableText(),
  kind: field.enumValue(ResourceKind),
  capacity: field.nullablePositiveInt(),
  createdAt: field.optionalDate(),
});

export const subjectConfigCommandSchema = namedObjectSchema("SubjectConfigCommand", {
  id: field.id(),
  name: field.text(),
  code: field.nullableText(),
  defaultCoefficient: field.nullablePositiveNumber(),
  createdAt: field.optionalDate(),
});

export const subjectMatterConfigCommandSchema = namedObjectSchema("SubjectMatterConfigCommand", {
  id: field.id(),
  subjectId: field.id(),
  name: field.text(),
  description: field.nullableText(),
  sequenceOrder: field.positiveNumber(),
  estimatedHours: field.nullablePositiveNumber(),
  createdAt: field.optionalDate(),
});

export const disciplinaryActionConfigCommandSchema = namedObjectSchema("DisciplinaryActionConfigCommand", {
  id: field.id(),
  name: field.text(),
  kind: field.enumValue(DisciplinaryActionKind),
  severity: field.nullablePositiveNumber(),
  defaultDurationDays: field.nullablePositiveInt(),
  description: field.nullableText(),
  createdAt: field.optionalDate(),
});
