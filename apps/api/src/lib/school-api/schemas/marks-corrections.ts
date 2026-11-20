import { marksCorrectionSchema } from "@edaya/core";
import { z } from "@hono/zod-openapi";

export const marksCorrectionResponseSchema = marksCorrectionSchema.extend({
  createdAt: z.string().datetime(),
  revisions: z.array(marksCorrectionSchema.shape.revisions.removeDefault().element.extend({ at: z.string().datetime() })),
  decidedAt: z.string().datetime().optional(),
}).openapi("AssessmentMarksCorrectionResponse");
