import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { resourceAssignmentResponseSchema } from "@/validation/entities.schemas";
import { assignResourceToClassCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const assignResourceToClassRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/assignResourceToClass",
  tags: ["Setup Commands"],
  summary: "Assign Resource To Class",
  request: {
    body: jsonContent(assignResourceToClassCommandSchema, "Assign Resource To Class payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      resourceAssignmentResponseSchema,
      "Successfully executed Assign Resource To Class",
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

export const assignResourceToClassHandler: AppRouteHandler<typeof assignResourceToClassRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.assignResourceToClass>[0];

  try {
    const result = await headlessApp.setup.assignResourceToClass(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
