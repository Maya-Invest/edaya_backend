import type { AppRouteHandler } from "@/http/types";
import { staffActivityPupilOptionsInput, staffActivityPupilOptionsPage } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const staffActivityPupilOptionsQuery = staffActivityPupilOptionsInput.openapi("StaffActivityPupilOptionsQuery");
const staffActivityPupilOptionsResponse = staffActivityPupilOptionsPage.openapi("StaffActivityPupilOptionsResponse");
export const staffActivityPupilOptionsRoute = createRoute({
  method: "get",
  path: "/core/staff/activities/pupil-options",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffActivityPupilOptions", publicName: "staff-activity-pupil-options", requestSchema: staffActivityPupilOptionsQuery, responseSchema: staffActivityPupilOptionsResponse }),
  request: { query: staffActivityPupilOptionsQuery },
  responses: { 200: jsonContent(staffActivityPupilOptionsResponse, "Eligible pupils and linked class filters"), ...coreRouteErrorResponses },
});
export const staffActivityPupilOptionsHandler: AppRouteHandler<typeof staffActivityPupilOptionsRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStaffActivityPupilOptions(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
