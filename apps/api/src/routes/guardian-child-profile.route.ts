import type { AppRouteHandler } from "@/http/types";
import { guardianChildInput, guardianChildPhoto, guardianPapersInput, guardianPapersPage } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const guardianChildPhotoQuery = guardianChildInput.openapi("GuardianChildPhotoQuery");
const guardianChildPhotoResponse = guardianChildPhoto.openapi("GuardianChildPhotoResponse");
export const guardianChildPhotoRoute = createRoute({
  method: "get",
  path: "/core/guardian/child/photo",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianChildPhoto", publicName: "guardian-child-photo", requestSchema: guardianChildPhotoQuery, responseSchema: guardianChildPhotoResponse }),
  request: { query: guardianChildPhotoQuery },
  responses: { 200: jsonContent(guardianChildPhotoResponse, "Guardian-visible pupil and photo decision"), ...coreRouteErrorResponses },
});
export const guardianChildPhotoHandler: AppRouteHandler<typeof guardianChildPhotoRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianChildPhoto(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const guardianPapersQuery = guardianPapersInput.openapi("GuardianPapersQuery");
const guardianPapersResponse = guardianPapersPage.openapi("GuardianPapersResponse");
export const guardianPapersRoute = createRoute({
  method: "get",
  path: "/core/guardian/child/papers",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianPapers", publicName: "guardian-child-papers", requestSchema: guardianPapersQuery, responseSchema: guardianPapersResponse }),
  request: { query: guardianPapersQuery },
  responses: { 200: jsonContent(guardianPapersResponse, "A page of current school documents for this family"), ...coreRouteErrorResponses },
});
export const guardianPapersHandler: AppRouteHandler<typeof guardianPapersRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianPapers(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
