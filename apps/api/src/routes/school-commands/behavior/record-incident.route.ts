import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { incidentResponseSchema } from "@/validation/entities.schemas";
import { recordIncidentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const recordIncidentRoute = createRoute({
  method: "post",
  path: "/api/commands/behavior/recordIncident",
  tags: ["Behavior Commands"],
  summary: "Record Incident",
  request: {
    body: jsonContent(recordIncidentCommandSchema, "Record Incident payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      incidentResponseSchema,
      "Successfully executed Record Incident",
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

export const recordIncidentHandler: AppRouteHandler<typeof recordIncidentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.behavior.recordIncident>[0];

  try {
    const result = await headlessApp.behavior.recordIncident(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
