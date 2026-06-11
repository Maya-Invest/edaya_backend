import { z } from "@hono/zod-openapi";
import { timeOfDaySchema } from "@edaya/core";

export type AnySchema = z.ZodTypeAny;
export type ObjectSchema = z.ZodObject<z.ZodRawShape>;

/**
 * Accepts a raw shape from either plain zod or @hono/zod-openapi.
 * Uses Record<string, any> to bridge the structural incompatibility
 * between the two zod module augmentations.
 */
type AnyZodRawShape = Record<string, any>;

/**
 * Extracts the inner ZodObject.shape from a schema that may be
 * wrapped in ZodEffects (via .refine() / .superRefine() / .transform()).
 * If the schema is already a ZodObject, returns .shape directly.
 */
export function unwrapShape(schema: any): AnyZodRawShape {
  // Duck-type check for ZodEffects (works across zod module instances)
  if (schema && typeof schema.innerType === "function") {
    return unwrapShape(schema.innerType());
  }
  // Duck-type check for ZodObject
  if (schema && typeof schema === "object" && "shape" in schema) {
    return schema.shape;
  }
  throw new Error(`Cannot unwrap shape from ${schema?.constructor?.name}`);
}

export function responseSchema<T>(openApiName: string, shape: AnyZodRawShape): z.ZodType<T> {
  return z.object(shape as z.ZodRawShape).openapi(openApiName) as unknown as z.ZodType<T>;
}

export function valueSchema<T>(shape: AnyZodRawShape): z.ZodType<T> {
  return z.object(shape as z.ZodRawShape) as unknown as z.ZodType<T>;
}

export function namedObjectSchema(openApiName: string, shape: AnyZodRawShape): z.ZodObject<z.ZodRawShape> {
  return z.object(shape as z.ZodRawShape).openapi(openApiName) as unknown as z.ZodObject<z.ZodRawShape>;
}

export function arraySchema(itemSchema: AnySchema): AnySchema {
  return z.array(itemSchema);
}

export const field = {
  id: () => z.string().min(1),
  uuid: () => z.string().uuid(),
  nullableUuid: () => z.string().uuid().nullable().optional(),
  optionalUuid: () => z.string().uuid().optional(),
  string: () => z.string(),
  optionalString: () => z.string().optional(),
  text: () => z.string().min(1),
  nullableText: () => z.string().nullable().optional(),
  nullableEmail: () => z.string().email().nullable().optional(),
  number: () => z.number(),
  optionalNumber: () => z.number().optional(),
  nullableNumber: () => z.number().nullable().optional(),
  boolean: () => z.boolean(),
  optionalDate: () => z.coerce.date().optional(),
  date: () => z.coerce.date(),
  nullableDate: () => z.coerce.date().nullable().optional(),
  optionalBoolean: () => z.boolean().optional(),
  positiveInt: () => z.number().int().positive(),
  nullablePositiveInt: () => z.number().int().positive().nullable().optional(),
  nullableNonNegativeInt: () => z.number().int().nonnegative().nullable().optional(),
  positiveNumber: () => z.number().positive(),
  nullablePositiveNumber: () => z.number().positive().nullable().optional(),
  timeOfDay: () => timeOfDaySchema,
  enumValue: <T extends z.EnumLike>(values: T) => z.nativeEnum(values),
};

const queryOptionFields = new WeakMap<z.ZodTypeAny, readonly string[]>();

export function getQueryOptionFields(schema: z.ZodTypeAny): readonly string[] {
  return queryOptionFields.get(schema) ?? [];
}

function createFieldFilterSchema(valueSchema: z.ZodTypeAny) {
  return z.union([
    valueSchema,
    z.object({
      $eq: valueSchema.optional(),
      $ne: valueSchema.optional(),
      $in: z.array(valueSchema).optional(),
      $nin: z.array(valueSchema).optional(),
      $exists: z.boolean().optional(),
      $gt: valueSchema.optional(),
      $gte: valueSchema.optional(),
      $lt: valueSchema.optional(),
      $lte: valueSchema.optional(),
    }),
  ]);
}

const sortOptionSchema = z.object({
  field: z.string(),
  direction: z.enum(["asc", "desc"]),
});

let filterCounter = 0;

export function createQueryOptionsSchema<T extends Record<string, any>>(
  allowedFields: Record<keyof T, z.ZodTypeAny>,
  entityName?: string,
) {
  const filterShape: Record<string, z.ZodTypeAny> = {};
  for (const key of Object.keys(allowedFields) as Array<keyof T>) {
    filterShape[key as string] = createFieldFilterSchema(allowedFields[key]).optional();
  }

  const schemaName = entityName ?? `Filter_${++filterCounter}`;

  const baseFilterSchema: z.ZodTypeAny = z.lazy(() =>
    z.object({
      ...filterShape,
      $and: z.array(baseFilterSchema).optional(),
      $or: z.array(baseFilterSchema).optional(),
      $not: baseFilterSchema.optional(),
    }),
  ).openapi(schemaName, { type: "object" });

  const queryOptionsSchema = baseFilterSchema.and(
    z.object({
      $orderBy: z.array(sortOptionSchema).optional(),
      $limit: z.number().int().positive().optional(),
      $offset: z.number().int().nonnegative().optional(),
    }),
  );

  queryOptionFields.set(queryOptionsSchema, Object.keys(allowedFields));

  return queryOptionsSchema;
}
