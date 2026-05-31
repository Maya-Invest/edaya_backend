import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { staffAssignmentResponseSchema } from "@/validation/entities.schemas";
import { assignStaffToClassCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const assignStaffToClassRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/assignStaffToClass",
  tags: ["Setup Commands"],
  summary: "Assign Staff To Class",
  request: {
    body: jsonContent(assignStaffToClassCommandSchema, "Assign Staff To Class payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      staffAssignmentResponseSchema,
      "Successfully executed Assign Staff To Class",
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

export const assignStaffToClassHandler: AppRouteHandler<typeof assignStaffToClassRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.assignStaffToClass>[0];

  try {
    const result = await headlessApp.setup.assignStaffToClass(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
