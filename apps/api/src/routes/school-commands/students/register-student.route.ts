import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentResponseSchema } from "@/validation/entities.schemas";
import { registerStudentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const registerStudentRoute = createRoute({
  method: "post",
  path: "/api/commands/students/registerStudent",
  tags: ["Students Commands"],
  summary: "Register Student",
  request: {
    body: jsonContent(registerStudentCommandSchema, "Register Student payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentResponseSchema,
      "Successfully executed Register Student",
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

export const registerStudentHandler: AppRouteHandler<typeof registerStudentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.registerStudent>[0];

  try {
    const result = await headlessApp.students.registerStudent(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
