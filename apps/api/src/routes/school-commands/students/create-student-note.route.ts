import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentNoteResponseSchema } from "@/validation/entities.schemas";
import { createStudentNoteCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createStudentNoteRoute = createRoute({
  method: "post",
  path: "/api/commands/students/createStudentNote",
  tags: ["Students Commands"],
  summary: "Create Student Note",
  request: {
    body: jsonContent(createStudentNoteCommandSchema, "Create Student Note payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentNoteResponseSchema,
      "Successfully executed Create Student Note",
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

export const createStudentNoteHandler: AppRouteHandler<typeof createStudentNoteRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.createStudentNote>[0];

  try {
    const result = await headlessApp.students.createStudentNote(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
