import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { announcementResponseSchema } from "@/validation/entities.schemas";
import { createAnnouncementCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createAnnouncementRoute = createRoute({
  method: "post",
  path: "/api/commands/communications/createAnnouncement",
  tags: ["Communications Commands"],
  summary: "Create Announcement",
  request: {
    body: jsonContent(createAnnouncementCommandSchema, "Create Announcement payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      announcementResponseSchema,
      "Successfully executed Create Announcement",
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

export const createAnnouncementHandler: AppRouteHandler<typeof createAnnouncementRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.communications.createAnnouncement>[0];

  try {
    const result = await headlessApp.communications.createAnnouncement(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
