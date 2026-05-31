import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { assessmentResultResponseSchema } from "@/validation/entities.schemas";
import { recordAssessmentResultComplianceCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const recordAssessmentResultComplianceRoute = createRoute({
  method: "post",
  path: "/api/commands/assessments/recordAssessmentResultCompliance",
  tags: ["Assessments Commands"],
  summary: "Record Assessment Result Compliance",
  request: {
    body: jsonContent(recordAssessmentResultComplianceCommandSchema, "Record Assessment Result Compliance payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      assessmentResultResponseSchema,
      "Successfully executed Record Assessment Result Compliance",
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

export const recordAssessmentResultComplianceHandler: AppRouteHandler<typeof recordAssessmentResultComplianceRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.assessments.recordAssessmentResultCompliance>[0];

  try {
    const result = await headlessApp.assessments.recordAssessmentResultCompliance(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
