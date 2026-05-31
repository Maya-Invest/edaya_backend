import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentFeeResponseSchema } from "@/validation/entities.schemas";
import { assignFeeToStudentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const assignFeeToStudentRoute = createRoute({
  method: "post",
  path: "/api/commands/finance/assignFeeToStudent",
  tags: ["Finance Commands"],
  summary: "Assign Fee To Student",
  request: {
    body: jsonContent(assignFeeToStudentCommandSchema, "Assign Fee To Student payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentFeeResponseSchema,
      "Successfully executed Assign Fee To Student",
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

export const assignFeeToStudentHandler: AppRouteHandler<typeof assignFeeToStudentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.finance.assignFeeToStudent>[0];

  try {
    const result = await headlessApp.finance.assignFeeToStudent(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
