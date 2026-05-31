import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { scheduleResponseSchema } from "@/validation/entities.schemas";
import { createScheduleCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createScheduleRoute = createRoute({
  method: "post",
  path: "/api/commands/scheduling/createSchedule",
  tags: ["Scheduling Commands"],
  summary: "Create Schedule",
  request: {
    body: jsonContent(createScheduleCommandSchema, "Create Schedule payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      scheduleResponseSchema,
      "Successfully executed Create Schedule",
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

export const createScheduleHandler: AppRouteHandler<typeof createScheduleRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.scheduling.createSchedule>[0];

  try {
    const result = await headlessApp.scheduling.createSchedule(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
