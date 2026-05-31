import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { guardianResponseSchema } from "@/validation/entities.schemas";
import { registerGuardianCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const registerGuardianRoute = createRoute({
  method: "post",
  path: "/api/commands/students/registerGuardian",
  tags: ["Students Commands"],
  summary: "Register Guardian",
  request: {
    body: jsonContent(registerGuardianCommandSchema, "Register Guardian payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      guardianResponseSchema,
      "Successfully executed Register Guardian",
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

export const registerGuardianHandler: AppRouteHandler<typeof registerGuardianRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.students.registerGuardian>[0];

  try {
    const result = await headlessApp.students.registerGuardian(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
