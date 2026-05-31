import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { attendanceCommandListResponseSchema } from "@/validation/command-response.schemas";
import { recordSessionAttendanceCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const recordSessionAttendanceRoute = createRoute({
  method: "post",
  path: "/api/commands/scheduling/recordSessionAttendance",
  tags: ["Scheduling Commands"],
  summary: "Record Session Attendance",
  request: {
    body: jsonContent(recordSessionAttendanceCommandSchema, "Record Session Attendance payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      attendanceCommandListResponseSchema,
      "Successfully executed Record Session Attendance",
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

export const recordSessionAttendanceHandler: AppRouteHandler<typeof recordSessionAttendanceRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.scheduling.recordSessionAttendance>[0];

  try {
    const result = await headlessApp.scheduling.recordSessionAttendance(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
