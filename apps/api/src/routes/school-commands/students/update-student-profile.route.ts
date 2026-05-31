import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentResponseSchema } from "@/validation/entities.schemas";
import { updateStudentProfileCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateStudentProfileRoute = createRoute({
  method: "post",
  path: "/api/commands/students/updateStudentProfile",
  tags: ["Students Commands"],
  summary: "Update Student Profile",
  request: {
    body: jsonContent(updateStudentProfileCommandSchema, "Update Student Profile payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentResponseSchema,
      "Successfully executed Update Student Profile",
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

export const updateStudentProfileHandler: AppRouteHandler<typeof updateStudentProfileRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.updateStudentProfile>[0];

  try {
    const result = await headlessApp.students.updateStudentProfile(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
