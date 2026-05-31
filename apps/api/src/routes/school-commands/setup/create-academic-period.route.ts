import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { academicPeriodResponseSchema } from "@/validation/entities.schemas";
import { createAcademicPeriodCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createAcademicPeriodRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/createAcademicPeriod",
  tags: ["Setup Commands"],
  summary: "Create Academic Period",
  request: {
    body: jsonContent(createAcademicPeriodCommandSchema, "Create Academic Period payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      academicPeriodResponseSchema,
      "Successfully executed Create Academic Period",
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

export const createAcademicPeriodHandler: AppRouteHandler<typeof createAcademicPeriodRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.createAcademicPeriod>[0];

  try {
    const result = await headlessApp.setup.createAcademicPeriod(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
