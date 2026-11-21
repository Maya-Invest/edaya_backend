import type { AppRouteHandler } from "@/http/types";
import { classReportRosterInput, classReportRosterPage } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const classReportRosterQuery = classReportRosterInput.openapi("ClassReportRosterQuery");
const classReportRosterResponse = classReportRosterPage.openapi("ClassReportRosterResponse");
export const classReportRosterRoute = createRoute({
  method: "get",
  path: "/core/reports/class-roster",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getClassReportRoster", publicName: "class-report-roster", requestSchema: classReportRosterQuery, responseSchema: classReportRosterResponse }),
  request: { query: classReportRosterQuery },
  responses: { 200: jsonContent(classReportRosterResponse, "Authorized class pupils and full-period report totals"), ...coreRouteErrorResponses },
});
export const classReportRosterHandler: AppRouteHandler<typeof classReportRosterRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getClassReportRoster(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
