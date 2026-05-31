import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { staffMemberResponseSchema } from "@/validation/entities.schemas";
import { updateStaffMemberStatusCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const updateStaffMemberStatusRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/updateStaffMemberStatus",
  tags: ["Setup Commands"],
  summary: "Update Staff Member Status",
  request: {
    body: jsonContent(updateStaffMemberStatusCommandSchema, "Update Staff Member Status payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      staffMemberResponseSchema,
      "Successfully executed Update Staff Member Status",
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

export const updateStaffMemberStatusHandler: AppRouteHandler<typeof updateStaffMemberStatusRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.updateStaffMemberStatus>[0];

  try {
    const result = await headlessApp.setup.updateStaffMemberStatus(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
