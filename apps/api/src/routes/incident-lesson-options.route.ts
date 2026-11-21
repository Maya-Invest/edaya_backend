import type { AppRouteHandler } from "@/http/types";
import { incidentLessonOptionsInput, incidentLessonOptionsPage } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const incidentLessonOptionsQuery = incidentLessonOptionsInput.openapi("IncidentLessonOptionsQuery");
const incidentLessonOptionsResponse = incidentLessonOptionsPage.openapi("IncidentLessonOptionsResponse");
export const incidentLessonOptionsRoute = createRoute({
  method: "get",
  path: "/core/staff/incidents/lesson-options",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getIncidentLessonOptions", publicName: "incident-lesson-options", requestSchema: incidentLessonOptionsQuery, responseSchema: incidentLessonOptionsResponse }),
  request: { query: incidentLessonOptionsQuery },
  responses: { 200: jsonContent(incidentLessonOptionsResponse, "A page of visible lesson options and the selected lesson"), ...coreRouteErrorResponses },
});
export const incidentLessonOptionsHandler: AppRouteHandler<typeof incidentLessonOptionsRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getIncidentLessonOptions(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
