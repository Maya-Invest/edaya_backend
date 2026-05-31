import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { resultResponseSchema } from "@/validation/entities.schemas";
import { publishReportCardResultCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const publishReportCardResultRoute = createRoute({
  method: "post",
  path: "/api/commands/assessments/publishReportCardResult",
  tags: ["Assessments Commands"],
  summary: "Publish Report Card Result",
  request: {
    body: jsonContent(publishReportCardResultCommandSchema, "Publish Report Card Result payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      resultResponseSchema,
      "Successfully executed Publish Report Card Result",
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

export const publishReportCardResultHandler: AppRouteHandler<typeof publishReportCardResultRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.assessments.publishReportCardResult>[0];

  try {
    const result = await headlessApp.assessments.publishReportCardResult(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
