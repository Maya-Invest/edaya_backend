import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { staffAssignmentResponseSchema } from "@/validation/entities.schemas";
import { assignStaffToClassSubjectCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const assignStaffToClassSubjectRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/assignStaffToClassSubject",
  tags: ["Setup Commands"],
  summary: "Assign Staff To Class Subject",
  request: {
    body: jsonContent(assignStaffToClassSubjectCommandSchema, "Assign Staff To Class Subject payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      staffAssignmentResponseSchema,
      "Successfully executed Assign Staff To Class Subject",
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

export const assignStaffToClassSubjectHandler: AppRouteHandler<typeof assignStaffToClassSubjectRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.assignStaffToClassSubject>[0];

  try {
    const result = await headlessApp.setup.assignStaffToClassSubject(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
