import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { calendarEventResponseSchema } from "@/validation/entities.schemas";
import { createCalendarEventCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createCalendarEventRoute = createRoute({
  method: "post",
  path: "/api/commands/scheduling/createCalendarEvent",
  tags: ["Scheduling Commands"],
  summary: "Create Calendar Event",
  request: {
    body: jsonContent(createCalendarEventCommandSchema, "Create Calendar Event payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      calendarEventResponseSchema,
      "Successfully executed Create Calendar Event",
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

export const createCalendarEventHandler: AppRouteHandler<typeof createCalendarEventRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.scheduling.createCalendarEvent>[0];

  try {
    const result = await headlessApp.scheduling.createCalendarEvent(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
