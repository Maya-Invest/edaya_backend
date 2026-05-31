import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { enrollmentResponseSchema } from "@/validation/entities.schemas";
import { enrollStudentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const enrollStudentRoute = createRoute({
  method: "post",
  path: "/api/commands/students/enrollStudent",
  tags: ["Students Commands"],
  summary: "Enroll Student",
  request: {
    body: jsonContent(enrollStudentCommandSchema, "Enroll Student payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      enrollmentResponseSchema,
      "Successfully executed Enroll Student",
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

export const enrollStudentHandler: AppRouteHandler<typeof enrollStudentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.enrollStudent>[0];

  try {
    const result = await headlessApp.students.enrollStudent(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
