import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { countResponseSchema, schoolIdBodySchema } from "@/validation/route.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const overdueFeeCountRoute = createRoute({
  method: "post",
  path: "/api/queries/getOverdueFeeCount",
  tags: ["Custom Queries"],
  summary: "Get count of overdue fees",
  request: {
    body: jsonContent(schoolIdBodySchema, "School ID parameter"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      countResponseSchema,
      "Successfully retrieved count of overdue fees",
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

export const overdueFeeCountHandler: AppRouteHandler<typeof overdueFeeCountRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const { schoolId } = c.req.valid("json");
  const headlessApp = c.get("schoolApp").forActor(actor);

  try {
    const count = await headlessApp.queries.getOverdueFeeCount(schoolId);
    return c.json({ count }, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
