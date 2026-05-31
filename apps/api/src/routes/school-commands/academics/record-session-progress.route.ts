import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { classSubjectProgressResponseSchema } from "@/validation/entities.schemas";
import { recordSessionProgressCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const recordSessionProgressRoute = createRoute({
  method: "post",
  path: "/api/commands/academics/recordSessionProgress",
  tags: ["Academics Commands"],
  summary: "Record Session Progress",
  request: {
    body: jsonContent(recordSessionProgressCommandSchema, "Record Session Progress payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      classSubjectProgressResponseSchema,
      "Successfully executed Record Session Progress",
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

export const recordSessionProgressHandler: AppRouteHandler<typeof recordSessionProgressRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.academics.recordSessionProgress>[0];

  try {
    const result = await headlessApp.academics.recordSessionProgress(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
