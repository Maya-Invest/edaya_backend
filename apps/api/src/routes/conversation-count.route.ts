import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import type { AppRouteHandler } from "@/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const conversationCountQuery = z.object({}).openapi("UnresolvedConversationCountQuery");
const responseSchema = z.object({ count: z.number().int().nonnegative() }).openapi("UnresolvedConversationCount");
export const conversationCountRoute = createRoute({
  method: "get",
  path: "/core/inbox/unresolved-count",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getUnresolvedConversationCount", publicName: "unresolved-conversation-count", requestSchema: conversationCountQuery, responseSchema }),
  request: { query: conversationCountQuery },
  responses: { 200: jsonContent(responseSchema, "Unresolved conversations visible to this profile"), ...coreRouteErrorResponses },
});

export const conversationCountHandler: AppRouteHandler<typeof conversationCountRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    c.header("Cache-Control", "private, no-store");
    return c.json(await c.get("schoolApp").forActor(actor).getUnresolvedConversationCount(), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
