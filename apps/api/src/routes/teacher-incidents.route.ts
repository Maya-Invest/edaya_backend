import type { AppRouteHandler } from "@/http/types";
import { teacherIncidentDetailInput, teacherIncidentItem, teacherIncidentsInput, teacherIncidentsPage } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

import { teacherWorkflowEligibilityResponseSchema } from "@/lib/school-api/schemas/teacher-corrections";

export const teacherIncidentsQuery = teacherIncidentsInput.openapi("TeacherIncidentsQuery");
const teacherIncidentsResponse = teacherIncidentsPage.openapi("TeacherIncidentsPage");
export const teacherIncidentsRoute = createRoute({
  method: "get",
  path: "/core/teacher/incidents",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getTeacherIncidents", publicName: "teacher-incidents", requestSchema: teacherIncidentsQuery, responseSchema: teacherIncidentsResponse }),
  request: { query: teacherIncidentsQuery },
  responses: { 200: jsonContent(teacherIncidentsResponse, "Page of incidents authored by the teacher in the selected class"), ...coreRouteErrorResponses },
});
export const teacherIncidentsHandler: AppRouteHandler<typeof teacherIncidentsRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getTeacherIncidents(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const teacherIncidentDetailQuery = teacherIncidentDetailInput.openapi("TeacherIncidentDetailQuery");
const teacherIncidentDetailResponse = z.object({ incident: teacherIncidentItem, eligibility: teacherWorkflowEligibilityResponseSchema }).openapi("TeacherIncidentDetail");
export const teacherIncidentDetailRoute = createRoute({
  method: "get",
  path: "/core/teacher/incidents/detail",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getTeacherIncidentDetail", publicName: "teacher-incident-detail", requestSchema: teacherIncidentDetailQuery, responseSchema: teacherIncidentDetailResponse }),
  request: { query: teacherIncidentDetailQuery },
  responses: { 200: jsonContent(teacherIncidentDetailResponse, "Selected incident and its authorized workflow state"), ...coreRouteErrorResponses },
});
export const teacherIncidentDetailHandler: AppRouteHandler<typeof teacherIncidentDetailRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getTeacherIncidentDetail(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
