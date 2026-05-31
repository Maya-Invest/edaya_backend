import { z } from "@hono/zod-openapi";

// Generic field filter helper schema
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

  return baseFilterSchema.and(
    z.object({
      $orderBy: z.array(sortOptionSchema).optional(),
      $limit: z.number().int().positive().optional(),
      $offset: z.number().int().nonnegative().optional(),
    }),
  );
}
