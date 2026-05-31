import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { schoolResponseSchema } from "@/validation/entities.schemas";
import { updateSchoolConfigurationCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateSchoolConfigurationRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/updateSchoolConfiguration",
  tags: ["Setup Commands"],
  summary: "Update School Configuration",
  request: {
    body: jsonContent(updateSchoolConfigurationCommandSchema, "Update School Configuration payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      schoolResponseSchema,
      "Successfully executed Update School Configuration",
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

export const updateSchoolConfigurationHandler: AppRouteHandler<typeof updateSchoolConfigurationRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.updateSchoolConfiguration>[0];

  try {
    const result = await headlessApp.setup.updateSchoolConfiguration(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
