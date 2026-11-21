import type { AppRouteHandler } from "@/http/types";
import { staffFeedbackHistoryExport, staffFeedbackHistoryFilter, staffFeedbackHistoryInput, staffFeedbackHistoryPage } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const historyQuery = staffFeedbackHistoryInput.openapi("StaffFeedbackHistoryQuery");
const historyResponse = staffFeedbackHistoryPage.openapi("StaffFeedbackHistoryResponse");
export const historyRoute = createRoute({
  method: "get",
  path: "/core/staff/feedback/history",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffFeedbackHistory", publicName: "staff-feedback-history", requestSchema: historyQuery, responseSchema: historyResponse }),
  request: { query: historyQuery },
  responses: { 200: jsonContent(historyResponse, "A page of matching campaigns and the complete filtered count"), ...coreRouteErrorResponses },
});
export const historyHandler: AppRouteHandler<typeof historyRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStaffFeedbackHistory(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const historyExportQuery = staffFeedbackHistoryFilter.openapi("StaffFeedbackHistoryExportQuery");
const historyExportResponse = staffFeedbackHistoryExport.openapi("StaffFeedbackHistoryExportResponse");
export const historyExportRoute = createRoute({
  method: "get",
  path: "/core/staff/feedback/history/export",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffFeedbackHistoryExport", publicName: "staff-feedback-history-export", requestSchema: historyExportQuery, responseSchema: historyExportResponse }),
  request: { query: historyExportQuery },
  responses: { 200: jsonContent(historyExportResponse, "All matching campaign summaries for export"), ...coreRouteErrorResponses },
});
export const historyExportHandler: AppRouteHandler<typeof historyExportRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStaffFeedbackHistoryExport(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
