import type { AppRouteHandler } from "@/http/types";
import { dailyAttendanceStatusInput } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const dailyAttendanceStatusQuery = dailyAttendanceStatusInput.openapi("TeacherDailyAttendanceStatusQuery");
const status = z.object({ submitted: z.boolean() }).openapi("TeacherDailyAttendanceStatus");
export const dailyAttendanceStatusRoute = createRoute({
  method: "get",
  path: "/core/teacher/home/daily-attendance-status",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getTeacherDailyAttendanceStatus", publicName: "teacher-daily-attendance-status", requestSchema: dailyAttendanceStatusQuery, responseSchema: status }),
  request: { query: dailyAttendanceStatusQuery },
  responses: { 200: jsonContent(status, "Daily attendance register submission status"), ...coreRouteErrorResponses },
});
export const dailyAttendanceStatusHandler: AppRouteHandler<typeof dailyAttendanceStatusRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getTeacherDailyAttendanceStatus(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
