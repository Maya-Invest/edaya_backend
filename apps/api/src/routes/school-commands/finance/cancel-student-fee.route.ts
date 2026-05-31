import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentFeeResponseSchema } from "@/validation/entities.schemas";
import { cancelStudentFeeCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const cancelStudentFeeRoute = createRoute({
  method: "post",
  path: "/api/commands/finance/cancelStudentFee",
  tags: ["Finance Commands"],
  summary: "Cancel Student Fee",
  request: {
    body: jsonContent(cancelStudentFeeCommandSchema, "Cancel Student Fee payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentFeeResponseSchema,
      "Successfully executed Cancel Student Fee",
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

export const cancelStudentFeeHandler: AppRouteHandler<typeof cancelStudentFeeRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.finance.cancelStudentFee>[0];

  try {
    const result = await headlessApp.finance.cancelStudentFee(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
