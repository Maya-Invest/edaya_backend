import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { announcementResponseSchema } from "@/validation/entities.schemas";
import { publishAnnouncementCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const publishAnnouncementRoute = createRoute({
  method: "post",
  path: "/api/commands/communications/publishAnnouncement",
  tags: ["Communications Commands"],
  summary: "Publish Announcement",
  request: {
    body: jsonContent(publishAnnouncementCommandSchema, "Publish Announcement payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      announcementResponseSchema,
      "Successfully executed Publish Announcement",
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

export const publishAnnouncementHandler: AppRouteHandler<typeof publishAnnouncementRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.communications.publishAnnouncement>[0];

  try {
    const result = await headlessApp.communications.publishAnnouncement(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
