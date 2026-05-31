import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { commandMessageResponseSchema } from "@/validation/command-response.schemas";
import { removeResourceAssignmentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const removeResourceAssignmentRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/removeResourceAssignment",
  tags: ["Setup Commands"],
  summary: "Remove Resource Assignment",
  request: {
    body: jsonContent(removeResourceAssignmentCommandSchema, "Remove Resource Assignment payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      commandMessageResponseSchema,
      "Successfully executed Remove Resource Assignment",
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

export const removeResourceAssignmentHandler: AppRouteHandler<typeof removeResourceAssignmentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.removeResourceAssignment>[0];

  try {
    await headlessApp.setup.removeResourceAssignment(payload);
    return c.json({ message: "setup.removeResourceAssignment completed" }, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
