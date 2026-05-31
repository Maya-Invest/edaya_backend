import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { attendanceResponseSchema } from "@/validation/entities.schemas";
import { recordDailyAttendanceCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const recordDailyAttendanceRoute = createRoute({
  method: "post",
  path: "/api/commands/scheduling/recordDailyAttendance",
  tags: ["Scheduling Commands"],
  summary: "Record Daily Attendance",
  request: {
    body: jsonContent(recordDailyAttendanceCommandSchema, "Record Daily Attendance payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      attendanceResponseSchema,
      "Successfully executed Record Daily Attendance",
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

export const recordDailyAttendanceHandler: AppRouteHandler<typeof recordDailyAttendanceRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.scheduling.recordDailyAttendance>[0];

  try {
    const result = await headlessApp.scheduling.recordDailyAttendance(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
