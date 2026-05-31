import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { enrollmentResponseSchema } from "@/validation/entities.schemas";
import { closeEnrollmentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const closeEnrollmentRoute = createRoute({
  method: "post",
  path: "/api/commands/students/closeEnrollment",
  tags: ["Students Commands"],
  summary: "Close Enrollment",
  request: {
    body: jsonContent(closeEnrollmentCommandSchema, "Close Enrollment payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      enrollmentResponseSchema,
      "Successfully executed Close Enrollment",
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

export const closeEnrollmentHandler: AppRouteHandler<typeof closeEnrollmentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.closeEnrollment>[0];

  try {
    const result = await headlessApp.students.closeEnrollment(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
