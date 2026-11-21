import { classRosterMembersInput, studentDirectoryInput, studentDirectoryPage } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import type { AppRouteHandler } from "@/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const studentDirectoryQuery = studentDirectoryInput.openapi("StudentDirectoryQuery");
export const classRosterMembersQuery = classRosterMembersInput.openapi("ClassRosterMembersQuery");
const members = z.object({ studentIds: z.array(z.string()) }).openapi("ClassRosterMembers");
export const classRosterMembersRoute = createRoute({
  method: "get",
  path: "/core/directory/class-roster/member-ids",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getClassRosterMemberIds", publicName: "class-roster-member-ids", requestSchema: classRosterMembersQuery, responseSchema: members }),
  request: { query: classRosterMembersQuery },
  responses: { 200: jsonContent(members, "Matching student IDs for the selected class"), ...coreRouteErrorResponses },
});
export const classRosterMembersHandler: AppRouteHandler<typeof classRosterMembersRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getClassRosterMemberIds(c.req.valid("query")), 200);
  }
  catch (error) { return routeErrorResponse(c, error); }
};
const response = studentDirectoryPage.openapi("StudentDirectoryPage");
export const studentDirectoryRoute = createRoute({
  method: "get",
  path: "/core/directory/students",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStudentDirectory", publicName: "student-directory", requestSchema: studentDirectoryQuery, responseSchema: response }),
  request: { query: studentDirectoryQuery },
  responses: { 200: jsonContent(response, "Authorized student directory page"), 304: { description: "Current authorized directory representation" }, ...coreRouteErrorResponses },
});
export const studentDirectoryHandler: AppRouteHandler<typeof studentDirectoryRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    c.header("Cache-Control", "private, no-store");
    const { etag, page } = await c.get("schoolApp").forActor(actor).revalidateStudentDirectory(c.req.valid("query"), c.req.header("If-None-Match"));
    c.header("ETag", etag);
    c.header("Cache-Control", "private, no-cache");
    c.header("Vary", "Authorization, X-Actor-Kind, X-Actor-Id, X-School-Id, X-Academic-Year-Id, Accept-Language", { append: true });
    return page ? c.json(page, 200) : c.body(null, 304);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
