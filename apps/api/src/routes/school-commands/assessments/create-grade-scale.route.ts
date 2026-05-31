import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { gradeScaleResponseSchema } from "@/validation/entities.schemas";
import { createGradeScaleCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createGradeScaleRoute = createRoute({
  method: "post",
  path: "/api/commands/assessments/createGradeScale",
  tags: ["Assessments Commands"],
  summary: "Create Grade Scale",
  request: {
    body: jsonContent(createGradeScaleCommandSchema, "Create Grade Scale payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      gradeScaleResponseSchema,
      "Successfully executed Create Grade Scale",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema(),
      "Missing or invalid authorization session",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema(),
      "Access denied due to authorization policies",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(),
      "Internal server error occurred",
    ),
  },
});

export const createGradeScaleHandler: AppRouteHandler<typeof createGradeScaleRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.assessments.createGradeScale>[0];

  try {
    const result = await headlessApp.assessments.createGradeScale(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
