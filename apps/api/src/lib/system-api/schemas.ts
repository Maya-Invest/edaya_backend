import { z } from "@hono/zod-openapi";

export const systemEntityIdParamSchema = z.object({
  id: z.string().min(1),
}).openapi("SystemEntityIdParam");

export const systemEntityContextSchema = z.object({
  schoolId: z.string().min(1),
  systemId: z.string().min(1),
  reason: z.string().min(1),
}).openapi("SystemEntityContext");

export const systemEntityListRequestSchema = systemEntityContextSchema.extend({
  query: z.record(z.string(), z.any()).optional(),
}).openapi("SystemEntityListRequest");

export const systemEntityOneRequestSchema = systemEntityContextSchema.extend({
  query: z.record(z.string(), z.any()).optional(),
}).openapi("SystemEntityOneRequest");

export const systemEntitySaveRequestSchema = systemEntityContextSchema.extend({
  entity: z.record(z.string(), z.any()),
}).openapi("SystemEntitySaveRequest");

export type SystemEntityContext = z.infer<typeof systemEntityContextSchema>;
