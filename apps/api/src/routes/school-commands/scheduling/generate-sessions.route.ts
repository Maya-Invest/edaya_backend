import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { sessionCommandListResponseSchema } from "@/validation/command-response.schemas";
import { generateSessionsCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const generateSessionsRoute = createRoute({
  method: "post",
  path: "/api/commands/scheduling/generateSessions",
  tags: ["Scheduling Commands"],
  summary: "Generate Sessions",
  request: {
    body: jsonContent(generateSessionsCommandSchema, "Generate Sessions payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      sessionCommandListResponseSchema,
      "Successfully executed Generate Sessions",
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

export const generateSessionsHandler: AppRouteHandler<typeof generateSessionsRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.scheduling.generateSessions>[0];

  try {
    const result = await headlessApp.scheduling.generateSessions(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
