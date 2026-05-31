import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { feeResponseSchema } from "@/validation/entities.schemas";
import { createFeeCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createFeeRoute = createRoute({
  method: "post",
  path: "/api/commands/finance/createFee",
  tags: ["Finance Commands"],
  summary: "Create Fee",
  request: {
    body: jsonContent(createFeeCommandSchema, "Create Fee payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      feeResponseSchema,
      "Successfully executed Create Fee",
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

export const createFeeHandler: AppRouteHandler<typeof createFeeRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.finance.createFee>[0];

  try {
    const result = await headlessApp.finance.createFee(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
