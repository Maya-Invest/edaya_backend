import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { classGroupResponseSchema } from "@/validation/entities.schemas";
import { updateClassGroupConfigurationCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateClassGroupConfigurationRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/updateClassGroupConfiguration",
  tags: ["Setup Commands"],
  summary: "Update Class Group Configuration",
  request: {
    body: jsonContent(updateClassGroupConfigurationCommandSchema, "Update Class Group Configuration payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      classGroupResponseSchema,
      "Successfully executed Update Class Group Configuration",
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

export const updateClassGroupConfigurationHandler: AppRouteHandler<typeof updateClassGroupConfigurationRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.updateClassGroupConfiguration>[0];

  try {
    const result = await headlessApp.setup.updateClassGroupConfiguration(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
