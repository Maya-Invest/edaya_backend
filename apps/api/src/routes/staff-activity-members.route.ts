import type { AppRouteHandler } from "@/http/types";
import { staffActivityMembersInput, staffActivityMembersPage } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const staffActivityMembersQuery = staffActivityMembersInput.openapi("StaffActivityMembersQuery");
const staffActivityMembersResponse = staffActivityMembersPage.openapi("StaffActivityMembersResponse");
export const staffActivityMembersRoute = createRoute({
  method: "get",
  path: "/core/staff/activities/members",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffActivityMembers", publicName: "staff-activity-members", requestSchema: staffActivityMembersQuery, responseSchema: staffActivityMembersResponse }),
  request: { query: staffActivityMembersQuery },
  responses: { 200: jsonContent(staffActivityMembersResponse, "Visible memberships, total and selected membership"), ...coreRouteErrorResponses },
});
export const staffActivityMembersHandler: AppRouteHandler<typeof staffActivityMembersRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStaffActivityMembers(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
