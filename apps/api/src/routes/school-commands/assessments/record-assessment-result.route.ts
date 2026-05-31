import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { assessmentResultResponseSchema } from "@/validation/entities.schemas";
import { recordAssessmentResultCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const recordAssessmentResultRoute = createRoute({
  method: "post",
  path: "/api/commands/assessments/recordAssessmentResult",
  tags: ["Assessments Commands"],
  summary: "Record Assessment Result",
  request: {
    body: jsonContent(recordAssessmentResultCommandSchema, "Record Assessment Result payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      assessmentResultResponseSchema,
      "Successfully executed Record Assessment Result",
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

export const recordAssessmentResultHandler: AppRouteHandler<typeof recordAssessmentResultRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.assessments.recordAssessmentResult>[0];

  try {
    const result = await headlessApp.assessments.recordAssessmentResult(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
