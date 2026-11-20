import type { AppRouteHandler } from "@/http/types";
import { teacherLogbookInput, teacherLogbookPage } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const logbookQuery = teacherLogbookInput.openapi("TeacherLogbookQuery");
const response = teacherLogbookPage.openapi("TeacherLogbookPage");
export const teacherLogbookRoute = createRoute({
  method: "get",
  path: "/core/teacher/logbook",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getTeacherLogbook", publicName: "teacher-logbook", requestSchema: logbookQuery, responseSchema: response }),
  request: { query: logbookQuery },
  responses: { 200: jsonContent(response, "Page of lessons for the teacher's selected offering"), ...coreRouteErrorResponses },
});
export const teacherLogbookHandler: AppRouteHandler<typeof teacherLogbookRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getTeacherLogbook(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
