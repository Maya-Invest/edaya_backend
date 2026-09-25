import { marksCorrectionSchema } from "@edaya/core";
import { z } from "@hono/zod-openapi";

export const marksCorrectionResponseSchema = marksCorrectionSchema.extend({
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().optional(),
}).openapi("AssessmentMarksCorrectionResponse");
