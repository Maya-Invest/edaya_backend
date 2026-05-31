import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentFeeResponseSchema } from "@/validation/entities.schemas";
import { adjustStudentFeeCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const adjustStudentFeeRoute = createRoute({
  method: "post",
  path: "/api/commands/finance/adjustStudentFee",
  tags: ["Finance Commands"],
  summary: "Adjust Student Fee",
  request: {
    body: jsonContent(adjustStudentFeeCommandSchema, "Adjust Student Fee payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentFeeResponseSchema,
      "Successfully executed Adjust Student Fee",
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

export const adjustStudentFeeHandler: AppRouteHandler<typeof adjustStudentFeeRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.finance.adjustStudentFee>[0];

  try {
    const result = await headlessApp.finance.adjustStudentFee(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
