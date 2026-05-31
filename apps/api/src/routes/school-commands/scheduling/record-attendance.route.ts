import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { attendanceResponseSchema } from "@/validation/entities.schemas";
import { recordAttendanceCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const recordAttendanceRoute = createRoute({
  method: "post",
  path: "/api/commands/scheduling/recordAttendance",
  tags: ["Scheduling Commands"],
  summary: "Record Attendance",
  request: {
    body: jsonContent(recordAttendanceCommandSchema, "Record Attendance payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      attendanceResponseSchema,
      "Successfully executed Record Attendance",
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

export const recordAttendanceHandler: AppRouteHandler<typeof recordAttendanceRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.scheduling.recordAttendance>[0];

  try {
    const result = await headlessApp.scheduling.recordAttendance(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
