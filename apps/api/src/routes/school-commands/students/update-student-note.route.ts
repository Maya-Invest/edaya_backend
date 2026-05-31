import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentNoteResponseSchema } from "@/validation/entities.schemas";
import { updateStudentNoteCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateStudentNoteRoute = createRoute({
  method: "post",
  path: "/api/commands/students/updateStudentNote",
  tags: ["Students Commands"],
  summary: "Update Student Note",
  request: {
    body: jsonContent(updateStudentNoteCommandSchema, "Update Student Note payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentNoteResponseSchema,
      "Successfully executed Update Student Note",
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

export const updateStudentNoteHandler: AppRouteHandler<typeof updateStudentNoteRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.updateStudentNote>[0];

  try {
    const result = await headlessApp.students.updateStudentNote(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
