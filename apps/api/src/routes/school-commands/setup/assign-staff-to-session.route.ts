import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { staffAssignmentResponseSchema } from "@/validation/entities.schemas";
import { assignStaffToSessionCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const assignStaffToSessionRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/assignStaffToSession",
  tags: ["Setup Commands"],
  summary: "Assign Staff To Session",
  request: {
    body: jsonContent(assignStaffToSessionCommandSchema, "Assign Staff To Session payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      staffAssignmentResponseSchema,
      "Successfully executed Assign Staff To Session",
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

export const assignStaffToSessionHandler: AppRouteHandler<typeof assignStaffToSessionRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.assignStaffToSession>[0];

  try {
    const result = await headlessApp.setup.assignStaffToSession(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
