import type { AppRouteHandler } from "@/http/types";
import { getStudentPortraitGrants } from "@edaya/service";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

const reference = z.object({ studentId: z.string().min(1), attachmentId: z.string().min(1) }).strict();
const requestSchema = z.object({ photos: z.array(reference).min(1).max(25) }).strict().openapi("StudentPortraitGrantsQuery");
const responseSchema = z.object({ grants: z.array(reference.extend({
  checksum: z.string().nullable(),
  downloadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
})) }).openapi("StudentPortraitGrants");

export const portraitGrantsRoute = createRoute({
  method: "post",
  path: "/core/queries/get-student-portrait-grants",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getStudentPortraitGrants", publicName: "get-student-portrait-grants", requestSchema, responseSchema }),
  request: { body: jsonContent(requestSchema, "Visible directory portraits") },
  responses: { 200: jsonContent(responseSchema, "Currently authorized published portraits"), ...coreRouteErrorResponses },
});

export const portraitGrantsHandler: AppRouteHandler<typeof portraitGrantsRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    const { photos } = c.req.valid("json");
    return c.json(await getStudentPortraitGrants(c.var.schoolApp.forActor(actor).baseService, photos), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
