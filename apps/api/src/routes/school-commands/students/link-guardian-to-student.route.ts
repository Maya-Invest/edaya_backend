import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { guardianLinkResponseSchema } from "@/validation/entities.schemas";
import { linkGuardianToStudentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const linkGuardianToStudentRoute = createRoute({
  method: "post",
  path: "/api/commands/students/linkGuardianToStudent",
  tags: ["Students Commands"],
  summary: "Link Guardian To Student",
  request: {
    body: jsonContent(linkGuardianToStudentCommandSchema, "Link Guardian To Student payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      guardianLinkResponseSchema,
      "Successfully executed Link Guardian To Student",
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

export const linkGuardianToStudentHandler: AppRouteHandler<typeof linkGuardianToStudentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.linkGuardianToStudent>[0];

  try {
    const result = await headlessApp.students.linkGuardianToStudent(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
