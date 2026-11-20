import type { AppRouteHandler } from "@/http/types";
import { staffFeedbackOptionsInput, staffFeedbackOptionsPage, teacherFeedbackSelection, teacherFeedbackSummary } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { familyFeedbackCampaignProjectionQueryResponseSchema, guardianFamilyFeedbackCampaignListResponseSchema } from "@/lib/school-api/schemas/queries";

export const guardianFeedbackQuery = z.object({ studentId: z.string().min(1) }).openapi("GuardianFeedbackCampaignsQuery");
const guardianResponse = z.object({ items: guardianFamilyFeedbackCampaignListResponseSchema }).openapi("GuardianFeedbackCampaignsPage");
export const guardianFeedbackRoute = createRoute({
  method: "get",
  path: "/core/guardian/feedback/campaigns",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianFeedbackCampaigns", publicName: "guardian-feedback-campaigns", requestSchema: guardianFeedbackQuery, responseSchema: guardianResponse }),
  request: { query: guardianFeedbackQuery },
  responses: { 200: jsonContent(guardianResponse, "Campaigns visible for this pupil"), ...coreRouteErrorResponses },
});
export const guardianFeedbackHandler: AppRouteHandler<typeof guardianFeedbackRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json({ items: await c.get("schoolApp").forActor(actor).listGuardianFamilyFeedbackCampaigns(c.req.valid("query")) }, 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const teacherFeedbackQuery = teacherFeedbackSelection.openapi("TeacherFeedbackSummariesQuery");
const teacherResponse = z.object({ items: z.array(teacherFeedbackSummary) }).openapi("TeacherFeedbackSummaries");
export const teacherFeedbackRoute = createRoute({
  method: "get",
  path: "/core/teacher/feedback/summaries",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getTeacherFeedbackSummaries", publicName: "teacher-feedback-summaries", requestSchema: teacherFeedbackQuery, responseSchema: teacherResponse }),
  request: { query: teacherFeedbackQuery },
  responses: { 200: jsonContent(teacherResponse, "Published feedback summaries visible to this teacher"), ...coreRouteErrorResponses },
});
export const teacherFeedbackHandler: AppRouteHandler<typeof teacherFeedbackRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    const items = await c.get("schoolApp").forActor(actor).getTeacherFeedbackSummaries(c.req.valid("query"));
    return c.json({ items }, 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const staffFeedbackQuery = z.object({
  academicYearId: z.string().min(1).optional(),
  campaignId: z.string().min(1).optional(),
}).openapi("StaffFeedbackCampaignsQuery");
const staffResponse = z.object({
  items: z.array(familyFeedbackCampaignProjectionQueryResponseSchema.extend({
    assignment: z.object({
      teacherName: z.string().optional(),
      subjectName: z.string().optional(),
      classGroupId: z.string().nullish(),
    }).optional(),
    moderatorName: z.string().optional(),
  })),
}).openapi("StaffFeedbackCampaigns");
export const staffFeedbackRoute = createRoute({
  method: "get",
  path: "/core/staff/feedback/campaigns",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffFeedbackCampaigns", publicName: "staff-feedback-campaigns", requestSchema: staffFeedbackQuery, responseSchema: staffResponse }),
  request: { query: staffFeedbackQuery },
  responses: { 200: jsonContent(staffResponse, "Staff campaigns with the visible assignment and moderator names"), ...coreRouteErrorResponses },
});
export const staffFeedbackHandler: AppRouteHandler<typeof staffFeedbackRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    const items = await c.get("schoolApp").forActor(actor).getStaffFeedbackCampaigns(c.req.valid("query"));
    return c.json({ items }, 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const staffOptionsQuery = staffFeedbackOptionsInput.openapi("StaffFeedbackOptionsQuery");
const optionsResponse = staffFeedbackOptionsPage.openapi("StaffFeedbackOptionsPage");
export const staffOptionsRoute = createRoute({
  method: "get",
  path: "/core/staff/feedback/options",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStaffFeedbackOptions", publicName: "staff-feedback-options", requestSchema: staffOptionsQuery, responseSchema: optionsResponse }),
  request: { query: staffOptionsQuery },
  responses: { 200: jsonContent(optionsResponse, "A page of permitted campaign editor choices"), ...coreRouteErrorResponses },
});
export const staffOptionsHandler: AppRouteHandler<typeof staffOptionsRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getStaffFeedbackOptions(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
