import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { guardianLinkResponseSchema } from "@/validation/entities.schemas";
import { updateGuardianStudentLinkCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateGuardianStudentLinkRoute = createRoute({
  method: "post",
  path: "/api/commands/students/updateGuardianStudentLink",
  tags: ["Students Commands"],
  summary: "Update Guardian Student Link",
  request: {
    body: jsonContent(updateGuardianStudentLinkCommandSchema, "Update Guardian Student Link payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      guardianLinkResponseSchema,
      "Successfully executed Update Guardian Student Link",
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

export const updateGuardianStudentLinkHandler: AppRouteHandler<typeof updateGuardianStudentLinkRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.updateGuardianStudentLink>[0];

  try {
    const result = await headlessApp.students.updateGuardianStudentLink(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
