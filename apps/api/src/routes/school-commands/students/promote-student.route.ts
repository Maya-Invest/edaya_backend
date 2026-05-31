import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { enrollmentResponseSchema } from "@/validation/entities.schemas";
import { promoteStudentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const promoteStudentRoute = createRoute({
  method: "post",
  path: "/api/commands/students/promoteStudent",
  tags: ["Students Commands"],
  summary: "Promote Student",
  request: {
    body: jsonContent(promoteStudentCommandSchema, "Promote Student payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      enrollmentResponseSchema,
      "Successfully executed Promote Student",
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

export const promoteStudentHandler: AppRouteHandler<typeof promoteStudentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.promoteStudent>[0];

  try {
    const result = await headlessApp.students.promoteStudent(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
