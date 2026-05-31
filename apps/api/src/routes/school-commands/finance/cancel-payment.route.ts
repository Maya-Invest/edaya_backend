import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { paymentResponseSchema } from "@/validation/entities.schemas";
import { cancelPaymentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const cancelPaymentRoute = createRoute({
  method: "post",
  path: "/api/commands/finance/cancelPayment",
  tags: ["Finance Commands"],
  summary: "Cancel Payment",
  request: {
    body: jsonContent(cancelPaymentCommandSchema, "Cancel Payment payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      paymentResponseSchema,
      "Successfully executed Cancel Payment",
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

export const cancelPaymentHandler: AppRouteHandler<typeof cancelPaymentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.finance.cancelPayment>[0];

  try {
    const result = await headlessApp.finance.cancelPayment(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
