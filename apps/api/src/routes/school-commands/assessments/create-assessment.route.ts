import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { assessmentResponseSchema } from "@/validation/entities.schemas";
import { createAssessmentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createAssessmentRoute = createRoute({
  method: "post",
  path: "/api/commands/assessments/createAssessment",
  tags: ["Assessments Commands"],
  summary: "Create Assessment",
  request: {
    body: jsonContent(createAssessmentCommandSchema, "Create Assessment payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      assessmentResponseSchema,
      "Successfully executed Create Assessment",
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

export const createAssessmentHandler: AppRouteHandler<typeof createAssessmentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.assessments.createAssessment>[0];

  try {
    const result = await headlessApp.assessments.createAssessment(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
