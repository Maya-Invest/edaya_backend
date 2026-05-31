import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentResponseSchema } from "@/validation/entities.schemas";
import { updateStudentStatusCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateStudentStatusRoute = createRoute({
  method: "post",
  path: "/api/commands/students/updateStudentStatus",
  tags: ["Students Commands"],
  summary: "Update Student Status",
  request: {
    body: jsonContent(updateStudentStatusCommandSchema, "Update Student Status payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentResponseSchema,
      "Successfully executed Update Student Status",
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

export const updateStudentStatusHandler: AppRouteHandler<typeof updateStudentStatusRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.updateStudentStatus>[0];

  try {
    const result = await headlessApp.students.updateStudentStatus(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
