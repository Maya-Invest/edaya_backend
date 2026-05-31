import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { sessionResponseSchema } from "@/validation/entities.schemas";
import { createSessionCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createSessionRoute = createRoute({
  method: "post",
  path: "/api/commands/scheduling/createSession",
  tags: ["Scheduling Commands"],
  summary: "Create Session",
  request: {
    body: jsonContent(createSessionCommandSchema, "Create Session payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      sessionResponseSchema,
      "Successfully executed Create Session",
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

export const createSessionHandler: AppRouteHandler<typeof createSessionRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.scheduling.createSession>[0];

  try {
    const result = await headlessApp.scheduling.createSession(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
