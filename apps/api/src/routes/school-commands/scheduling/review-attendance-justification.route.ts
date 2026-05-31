import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { attendanceResponseSchema } from "@/validation/entities.schemas";
import { reviewAttendanceJustificationCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const reviewAttendanceJustificationRoute = createRoute({
  method: "post",
  path: "/api/commands/scheduling/reviewAttendanceJustification",
  tags: ["Scheduling Commands"],
  summary: "Review Attendance Justification",
  request: {
    body: jsonContent(reviewAttendanceJustificationCommandSchema, "Review Attendance Justification payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      attendanceResponseSchema,
      "Successfully executed Review Attendance Justification",
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

export const reviewAttendanceJustificationHandler: AppRouteHandler<typeof reviewAttendanceJustificationRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.scheduling.reviewAttendanceJustification>[0];

  try {
    const result = await headlessApp.scheduling.reviewAttendanceJustification(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
