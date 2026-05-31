import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { assessmentResponseSchema } from "@/validation/entities.schemas";
import { completeAssessmentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const completeAssessmentRoute = createRoute({
  method: "post",
  path: "/api/commands/assessments/completeAssessment",
  tags: ["Assessments Commands"],
  summary: "Complete Assessment",
  request: {
    body: jsonContent(completeAssessmentCommandSchema, "Complete Assessment payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      assessmentResponseSchema,
      "Successfully executed Complete Assessment",
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

export const completeAssessmentHandler: AppRouteHandler<typeof completeAssessmentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.assessments.completeAssessment>[0];

  try {
    const result = await headlessApp.assessments.completeAssessment(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
