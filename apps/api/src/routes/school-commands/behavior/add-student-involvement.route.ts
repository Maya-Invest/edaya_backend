import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentIncidentInvolvementResponseSchema } from "@/validation/entities.schemas";
import { addStudentInvolvementCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const addStudentInvolvementRoute = createRoute({
  method: "post",
  path: "/api/commands/behavior/addStudentInvolvement",
  tags: ["Behavior Commands"],
  summary: "Add Student Involvement",
  request: {
    body: jsonContent(addStudentInvolvementCommandSchema, "Add Student Involvement payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentIncidentInvolvementResponseSchema,
      "Successfully executed Add Student Involvement",
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

export const addStudentInvolvementHandler: AppRouteHandler<typeof addStudentInvolvementRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.behavior.addStudentInvolvement>[0];

  try {
    const result = await headlessApp.behavior.addStudentInvolvement(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
