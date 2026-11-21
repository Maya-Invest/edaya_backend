import type { AppRouteHandler } from "@/http/types";
import { staffActivityListExport, staffActivityListFilter, staffActivityListInput, staffActivityListPage, staffActivityListRow } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const activityListQuery = staffActivityListInput.openapi("StaffActivityListQuery");
const activityListResponse = staffActivityListPage.openapi("StaffActivityListResponse");
export const activityListRoute = createRoute({
  method: "get",
  path: "/core/staff/activities",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffActivityList", publicName: "staff-activity-list", requestSchema: activityListQuery, responseSchema: activityListResponse }),
  request: { query: activityListQuery },
  responses: { 200: jsonContent(activityListResponse, "A page of matching activities and the complete filtered count"), ...coreRouteErrorResponses },
});
export const activityListHandler: AppRouteHandler<typeof activityListRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStaffActivityList(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const activityListExportQuery = staffActivityListFilter.openapi("StaffActivityListExportQuery");
const activityListExportResponse = staffActivityListExport.openapi("StaffActivityListExportResponse");
export const activityListExportRoute = createRoute({
  method: "get",
  path: "/core/staff/activities/export",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffActivityListExport", publicName: "staff-activity-list-export", requestSchema: activityListExportQuery, responseSchema: activityListExportResponse }),
  request: { query: activityListExportQuery },
  responses: { 200: jsonContent(activityListExportResponse, "All matching activity summaries for export"), ...coreRouteErrorResponses },
});
export const activityListExportHandler: AppRouteHandler<typeof activityListExportRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStaffActivityListExport(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const activityProfileQuery = z.object({ activityId: z.string().min(1) }).openapi("StaffActivityProfileQuery");
const activityProfileResponse = z.object({ activity: staffActivityListRow.nullable() }).openapi("StaffActivityProfileResponse");
export const activityProfileRoute = createRoute({
  method: "get",
  path: "/core/staff/activities/profile",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffActivityProfile", publicName: "staff-activity-profile", requestSchema: activityProfileQuery, responseSchema: activityProfileResponse }),
  request: { query: activityProfileQuery },
  responses: { 200: jsonContent(activityProfileResponse, "The selected activity with its visible enrolment count"), ...coreRouteErrorResponses },
});
export const activityProfileHandler: AppRouteHandler<typeof activityProfileRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStaffActivityProfile(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
