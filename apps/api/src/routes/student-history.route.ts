import type { AppRouteHandler } from "@/http/types";
import { studentAttendanceHistoryInput, studentAttendanceHistoryPage, studentGradeHistoryInput, studentGradeHistoryPage } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const gradeQuery = studentGradeHistoryInput.openapi("StudentGradeHistoryQuery");
const gradeResponse = studentGradeHistoryPage.openapi("StudentGradeHistoryPage");
export const gradeRoute = createRoute({
  method: "get",
  path: "/core/students/history/grades",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStudentGradeHistory", publicName: "student-grade-history", requestSchema: gradeQuery, responseSchema: gradeResponse }),
  request: { query: gradeQuery },
  responses: { 200: jsonContent(gradeResponse, "Authorized student grade history page and complete totals"), ...coreRouteErrorResponses },
});
export const gradeHandler: AppRouteHandler<typeof gradeRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStudentGradeHistory(c.req.valid("query")), 200);
  }
  catch (error) { return routeErrorResponse(c, error); }
};

export const attendanceQuery = studentAttendanceHistoryInput.openapi("StudentAttendanceHistoryQuery");
const attendanceResponse = studentAttendanceHistoryPage.openapi("StudentAttendanceHistoryPage");
export const attendanceRoute = createRoute({
  method: "get",
  path: "/core/students/history/attendance",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStudentAttendanceHistory", publicName: "student-attendance-history", requestSchema: attendanceQuery, responseSchema: attendanceResponse }),
  request: { query: attendanceQuery },
  responses: { 200: jsonContent(attendanceResponse, "Authorized student attendance history page and complete totals"), ...coreRouteErrorResponses },
});
export const attendanceHandler: AppRouteHandler<typeof attendanceRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStudentAttendanceHistory(c.req.valid("query")), 200);
  }
  catch (error) { return routeErrorResponse(c, error); }
};
