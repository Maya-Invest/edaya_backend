import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { announcementTargetResponseSchema } from "@/validation/entities.schemas";
import { addTargetCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const addTargetRoute = createRoute({
  method: "post",
  path: "/api/commands/communications/addTarget",
  tags: ["Communications Commands"],
  summary: "Add Announcement Target",
  request: {
    body: jsonContent(addTargetCommandSchema, "Add Announcement Target payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      announcementTargetResponseSchema,
      "Successfully executed Add Announcement Target",
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

export const addTargetHandler: AppRouteHandler<typeof addTargetRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.communications.addTarget>[0];

  try {
    const result = await headlessApp.communications.addTarget(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
