import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { guardianResponseSchema } from "@/validation/entities.schemas";
import { updateGuardianContactMethodsCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateGuardianContactMethodsRoute = createRoute({
  method: "post",
  path: "/api/commands/students/updateGuardianContactMethods",
  tags: ["Students Commands"],
  summary: "Update Guardian Contact Methods",
  request: {
    body: jsonContent(updateGuardianContactMethodsCommandSchema, "Update Guardian Contact Methods payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      guardianResponseSchema,
      "Successfully executed Update Guardian Contact Methods",
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

export const updateGuardianContactMethodsHandler: AppRouteHandler<typeof updateGuardianContactMethodsRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.updateGuardianContactMethods>[0];

  try {
    const result = await headlessApp.students.updateGuardianContactMethods(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
