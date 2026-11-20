import type { AppRouteHandler } from "@/http/types";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { guardianPeriodResultsResponseSchema as periodResults } from "@/lib/school-api/schemas/queries";

export const overviewQuery = z.object({ studentId: z.string().min(1), periodId: z.string().min(1) }).openapi("GuardianPeriodOverviewQuery");
const overviewResponse = periodResults.omit({ marks: true }).openapi("GuardianPeriodOverview");
export const subjectQuery = overviewQuery.extend({
  subjectId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(4096).optional(),
  focusMarkId: z.string().min(1).optional(),
}).openapi("GuardianSubjectMarksQuery");
const mark = periodResults.shape.marks.element.partial({ designation: true });
const subjectResponse = z.object({
  periodId: z.string(),
  periodName: z.string(),
  academicYearId: z.string(),
  state: periodResults.shape.state,
  section: z.record(z.string(), z.unknown()).nullable(),
  marks: z.array(mark),
  focusedMark: mark.nullable(),
  nextCursor: z.string().nullable(),
}).openapi("GuardianSubjectMarksPage");

export const overviewRoute = createRoute({
  method: "get",
  path: "/core/guardian/results/overview",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianPeriodOverview", publicName: "guardian-period-overview", requestSchema: overviewQuery, responseSchema: overviewResponse }),
  request: { query: overviewQuery },
  responses: { 200: jsonContent(overviewResponse, "Period sections and comments for this pupil"), ...coreRouteErrorResponses },
});
export const overviewHandler: AppRouteHandler<typeof overviewRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianPeriodOverview(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const subjectRoute = createRoute({
  method: "get",
  path: "/core/guardian/results/subject",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianSubjectMarks", publicName: "guardian-subject-marks", requestSchema: subjectQuery, responseSchema: subjectResponse }),
  request: { query: subjectQuery },
  responses: { 200: jsonContent(subjectResponse, "One subject and a page of visible marks for this pupil"), ...coreRouteErrorResponses },
});
export const subjectHandler: AppRouteHandler<typeof subjectRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianSubjectMarks(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
