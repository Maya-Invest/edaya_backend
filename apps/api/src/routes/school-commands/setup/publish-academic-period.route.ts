import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { academicPeriodResponseSchema } from "@/validation/entities.schemas";
import { publishAcademicPeriodCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const publishAcademicPeriodRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/publishAcademicPeriod",
  tags: ["Setup Commands"],
  summary: "Publish Academic Period",
  request: {
    body: jsonContent(publishAcademicPeriodCommandSchema, "Publish Academic Period payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      academicPeriodResponseSchema,
      "Successfully executed Publish Academic Period",
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

export const publishAcademicPeriodHandler: AppRouteHandler<typeof publishAcademicPeriodRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.publishAcademicPeriod>[0];

  try {
    const result = await headlessApp.setup.publishAcademicPeriod(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
