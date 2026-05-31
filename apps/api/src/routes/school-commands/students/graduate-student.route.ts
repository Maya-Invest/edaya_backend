import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { enrollmentResponseSchema } from "@/validation/entities.schemas";
import { graduateStudentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const graduateStudentRoute = createRoute({
  method: "post",
  path: "/api/commands/students/graduateStudent",
  tags: ["Students Commands"],
  summary: "Graduate Student",
  request: {
    body: jsonContent(graduateStudentCommandSchema, "Graduate Student payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      enrollmentResponseSchema,
      "Successfully executed Graduate Student",
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

export const graduateStudentHandler: AppRouteHandler<typeof graduateStudentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.graduateStudent>[0];

  try {
    const result = await headlessApp.students.graduateStudent(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
