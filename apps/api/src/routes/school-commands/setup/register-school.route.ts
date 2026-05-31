import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { schoolResponseSchema } from "@/validation/entities.schemas";
import { registerSchoolCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const registerSchoolRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/registerSchool",
  tags: ["Setup Commands"],
  summary: "Register School",
  request: {
    body: jsonContent(registerSchoolCommandSchema, "Register School payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      schoolResponseSchema,
      "Successfully executed Register School",
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

export const registerSchoolHandler: AppRouteHandler<typeof registerSchoolRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.registerSchool>[0];

  try {
    const result = await headlessApp.setup.registerSchool(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
