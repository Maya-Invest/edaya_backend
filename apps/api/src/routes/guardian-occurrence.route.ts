import type { AppRouteHandler } from "@/http/types";
import { guardianAssessmentResultResponseSchema } from "@/lib/school-api/schemas/queries";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

const kind = z.enum(["lesson", "activity", "assessment"]);
export const occurrenceQuery = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  occurrenceId: z.string().min(1),
  kind: kind.optional(),
}).openapi("GuardianOccurrenceQuery");
const response = z.object({
  occurrence: z.object({
    id: z.string(),
    kind,
    title: z.string(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    classSubjectId: z.string().nullable(),
    subjectLabel: z.string().nullable(),
    status: z.string().nullable(),
    attendance: z.object({
      id: z.string(),
      date: z.string(),
      status: z.string(),
      justificationStatus: z.string(),
      reason: z.string().nullable(),
      lessonSessionId: z.string().optional(),
      activitySessionId: z.string().optional(),
      assessmentId: z.string().optional(),
    }).nullable(),
    logbook: z.object({ content: z.string(), chapters: z.array(z.object({ name: z.string().nullable(), completed: z.boolean().nullable(), notes: z.string().nullable() })) }).nullable(),
    assessment: z.object({ description: z.string().nullable(), maxScore: z.number(), coefficient: z.number(), mark: guardianAssessmentResultResponseSchema.shape.mark.unwrap().extend({ designation: z.string().optional() }).nullable() }).nullable(),
    activityNotes: z.string().nullable(),
  }).nullable(),
}).openapi("GuardianOccurrenceDetail");
export const guardianOccurrenceRoute = createRoute({
  method: "get",
  path: "/core/guardian/calendar/occurrence",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianOccurrenceDetail", publicName: "guardian-occurrence-detail", requestSchema: occurrenceQuery, responseSchema: response }),
  request: { query: occurrenceQuery },
  responses: { 200: jsonContent(response, "Selected calendar occurrence with pupil attendance and family-visible details"), ...coreRouteErrorResponses },
});

export const guardianOccurrenceHandler: AppRouteHandler<typeof guardianOccurrenceRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianOccurrenceDetail(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
