import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { staffMemberResponseSchema } from "@/validation/entities.schemas";
import { registerStaffMemberCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const registerStaffMemberRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/registerStaffMember",
  tags: ["Setup Commands"],
  summary: "Register Staff Member",
  request: {
    body: jsonContent(registerStaffMemberCommandSchema, "Register Staff Member payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      staffMemberResponseSchema,
      "Successfully executed Register Staff Member",
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

export const registerStaffMemberHandler: AppRouteHandler<typeof registerStaffMemberRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.registerStaffMember>[0];

  try {
    const result = await headlessApp.setup.registerStaffMember(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
