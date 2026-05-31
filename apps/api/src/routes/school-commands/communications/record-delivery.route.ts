import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { messageDeliveryResponseSchema } from "@/validation/entities.schemas";
import { recordDeliveryCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const recordDeliveryRoute = createRoute({
  method: "post",
  path: "/api/commands/communications/recordDelivery",
  tags: ["Communications Commands"],
  summary: "Record Message Delivery",
  request: {
    body: jsonContent(recordDeliveryCommandSchema, "Record Message Delivery payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      messageDeliveryResponseSchema,
      "Successfully executed Record Message Delivery",
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

export const recordDeliveryHandler: AppRouteHandler<typeof recordDeliveryRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.communications.recordDelivery>[0];

  try {
    const result = await headlessApp.communications.recordDelivery(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
