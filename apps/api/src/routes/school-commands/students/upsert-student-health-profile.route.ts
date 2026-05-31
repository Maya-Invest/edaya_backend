import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentHealthProfileResponseSchema } from "@/validation/entities.schemas";
import { upsertStudentHealthProfileCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const upsertStudentHealthProfileRoute = createRoute({
  method: "post",
  path: "/api/commands/students/upsertStudentHealthProfile",
  tags: ["Students Commands"],
  summary: "Upsert Student Health Profile",
  request: {
    body: jsonContent(upsertStudentHealthProfileCommandSchema, "Upsert Student Health Profile payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentHealthProfileResponseSchema,
      "Successfully executed Upsert Student Health Profile",
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

export const upsertStudentHealthProfileHandler: AppRouteHandler<typeof upsertStudentHealthProfileRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.upsertStudentHealthProfile>[0];

  try {
    const result = await headlessApp.students.upsertStudentHealthProfile(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
