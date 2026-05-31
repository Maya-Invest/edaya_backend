import type { AppRouteHandler } from "@/lib/types";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const schoolIdParamSchema = z.object({
  schoolId: z.string().uuid(),
});

export const publishedReportCardCountRoute = createRoute({
  method: "post",
  path: "/api/queries/getPublishedReportCardCount",
  tags: ["Custom Queries"],
  summary: "Get count of published report cards",
  request: {
    body: jsonContent(schoolIdParamSchema, "School ID parameter"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        count: z.number().int().nonnegative(),
      }),
      "Successfully retrieved count of published report cards",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema(),
      "Missing or invalid authorization session",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema(),
      "Access denied due to authorization policies",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema(),
      "Internal server error occurred",
    ),
  },
});

export const publishedReportCardCountHandler: AppRouteHandler<typeof publishedReportCardCountRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { schoolId } = c.req.valid("json");
  const headlessApp = c.get("schoolApp").forActor(actor);

  try {
    const count = await headlessApp.queries.getPublishedReportCardCount(schoolId);
    return c.json({ count }, HttpStatusCodes.OK);
  }
  catch (err: any) {
    if (err.name === "AuthorizationError") {
      return c.json({ message: err.message }, HttpStatusCodes.FORBIDDEN);
    }
    return c.json({ message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
