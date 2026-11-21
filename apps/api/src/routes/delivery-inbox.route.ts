import type { AppRouteHandler } from "@/http/types";
import { deliveryInboxPage, deliveryInboxQuery } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const deliveryQuery = deliveryInboxQuery.openapi("DeliveryInboxQuery");
const deliveryResponse = deliveryInboxPage.openapi("DeliveryInboxPage");
export const unreadQuery = z.object({}).openapi("UnreadConversationCountQuery");
const unreadResponse = z.object({ count: z.number().int().nonnegative() }).openapi("UnreadConversationCount");

export const deliveryRoute = createRoute({
  method: "get",
  path: "/core/inbox/deliveries",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getDeliveryInbox", publicName: "delivery-inbox", requestSchema: deliveryQuery, responseSchema: deliveryResponse }),
  request: { query: deliveryQuery },
  responses: { 200: jsonContent(deliveryResponse, "Page of school notices and full unread notice count for the selected profile"), ...coreRouteErrorResponses },
});
export const deliveryHandler: AppRouteHandler<typeof deliveryRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getDeliveryInbox(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const unreadRoute = createRoute({
  method: "get",
  path: "/core/inbox/unread-conversations",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getUnreadConversationCount", publicName: "unread-conversation-count", requestSchema: unreadQuery, responseSchema: unreadResponse }),
  request: { query: unreadQuery },
  responses: { 200: jsonContent(unreadResponse, "Unread conversations for the selected profile"), ...coreRouteErrorResponses },
});
export const unreadHandler: AppRouteHandler<typeof unreadRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getUnreadConversationCount(), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
