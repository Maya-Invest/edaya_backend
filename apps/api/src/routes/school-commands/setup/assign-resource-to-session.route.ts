import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { resourceAssignmentResponseSchema } from "@/validation/entities.schemas";
import { assignResourceToSessionCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const assignResourceToSessionRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/assignResourceToSession",
  tags: ["Setup Commands"],
  summary: "Assign Resource To Session",
  request: {
    body: jsonContent(assignResourceToSessionCommandSchema, "Assign Resource To Session payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      resourceAssignmentResponseSchema,
      "Successfully executed Assign Resource To Session",
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

export const assignResourceToSessionHandler: AppRouteHandler<typeof assignResourceToSessionRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.assignResourceToSession>[0];

  try {
    const result = await headlessApp.setup.assignResourceToSession(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
