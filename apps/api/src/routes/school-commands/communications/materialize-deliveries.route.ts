import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { messageDeliveryCommandListResponseSchema } from "@/validation/command-response.schemas";
import { materializeDeliveriesCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const materializeDeliveriesRoute = createRoute({
  method: "post",
  path: "/api/commands/communications/materializeDeliveries",
  tags: ["Communications Commands"],
  summary: "Materialize Deliveries",
  request: {
    body: jsonContent(materializeDeliveriesCommandSchema, "Materialize Deliveries payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      messageDeliveryCommandListResponseSchema,
      "Successfully executed Materialize Deliveries",
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

export const materializeDeliveriesHandler: AppRouteHandler<typeof materializeDeliveriesRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.communications.materializeDeliveries>[0];

  try {
    const result = await headlessApp.communications.materializeDeliveries(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
