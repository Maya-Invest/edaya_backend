import type { AppRouteHandler } from "@/http/types";
import { guardianChoices, guardianHighlights, guardianHighlightsInput } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const highlightsQuery = guardianHighlightsInput.openapi("GuardianHighlightsQuery");
const highlightsResponse = guardianHighlights.openapi("GuardianHighlights");
export const highlightsRoute = createRoute({
  method: "get",
  path: "/core/guardian/home/highlights",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianHighlights", publicName: "guardian-highlights", requestSchema: highlightsQuery, responseSchema: highlightsResponse }),
  request: { query: highlightsQuery },
  responses: { 200: jsonContent(highlightsResponse, "Highlights visible for this child"), ...coreRouteErrorResponses },
});
export const highlightsHandler: AppRouteHandler<typeof highlightsRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianHighlights(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const choicesQuery = z.object({}).openapi("GuardianChildChoicesQuery");
const choicesResponse = guardianChoices.openapi("GuardianChildChoices");
export const choicesRoute = createRoute({
  method: "get",
  path: "/core/guardian/child-choices",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianChildChoices", publicName: "guardian-child-choices", requestSchema: choicesQuery, responseSchema: choicesResponse }),
  request: { query: choicesQuery },
  responses: { 200: jsonContent(choicesResponse, "Currently visible children and enrollment years"), ...coreRouteErrorResponses },
});
export const choicesHandler: AppRouteHandler<typeof choicesRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianChildChoices(), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
