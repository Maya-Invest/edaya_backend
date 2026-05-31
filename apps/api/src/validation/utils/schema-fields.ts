import { z } from "@hono/zod-openapi";

export type AnySchema = z.ZodTypeAny;
export type ObjectSchema = z.ZodObject<z.ZodRawShape>;

export function responseSchema<T>(openApiName: string, shape: z.ZodRawShape): z.ZodType<T> {
  return z.object(shape).openapi(openApiName) as unknown as z.ZodType<T>;
}

export function valueSchema<T>(shape: z.ZodRawShape): z.ZodType<T> {
  return z.object(shape) as unknown as z.ZodType<T>;
}

export function namedObjectSchema(openApiName: string, shape: z.ZodRawShape): z.ZodObject<z.ZodRawShape> {
  return z.object(shape).openapi(openApiName) as unknown as z.ZodObject<z.ZodRawShape>;
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
  timeOfDay: () => z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  enumValue: <T extends z.EnumLike>(values: T) => z.nativeEnum(values),
};
