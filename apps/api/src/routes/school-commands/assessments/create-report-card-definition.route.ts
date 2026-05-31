import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { definitionResponseSchema } from "@/validation/entities.schemas";
import { createReportCardDefinitionCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createReportCardDefinitionRoute = createRoute({
  method: "post",
  path: "/api/commands/assessments/createReportCardDefinition",
  tags: ["Assessments Commands"],
  summary: "Create Report Card Definition",
  request: {
    body: jsonContent(createReportCardDefinitionCommandSchema, "Create Report Card Definition payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      definitionResponseSchema,
      "Successfully executed Create Report Card Definition",
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

export const createReportCardDefinitionHandler: AppRouteHandler<typeof createReportCardDefinitionRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.assessments.createReportCardDefinition>[0];

  try {
    const result = await headlessApp.assessments.createReportCardDefinition(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
