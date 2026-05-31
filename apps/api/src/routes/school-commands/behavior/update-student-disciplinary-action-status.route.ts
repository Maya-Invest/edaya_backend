import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentDisciplinaryActionResponseSchema } from "@/validation/entities.schemas";
import { updateStudentDisciplinaryActionStatusCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateStudentDisciplinaryActionStatusRoute = createRoute({
  method: "post",
  path: "/api/commands/behavior/updateStudentDisciplinaryActionStatus",
  tags: ["Behavior Commands"],
  summary: "Update Student Disciplinary Action Status",
  request: {
    body: jsonContent(updateStudentDisciplinaryActionStatusCommandSchema, "Update Student Disciplinary Action Status payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentDisciplinaryActionResponseSchema,
      "Successfully executed Update Student Disciplinary Action Status",
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

export const updateStudentDisciplinaryActionStatusHandler: AppRouteHandler<typeof updateStudentDisciplinaryActionStatusRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.behavior.updateStudentDisciplinaryActionStatus>[0];

  try {
    const result = await headlessApp.behavior.updateStudentDisciplinaryActionStatus(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
