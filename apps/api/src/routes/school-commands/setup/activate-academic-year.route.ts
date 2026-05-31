import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { academicYearResponseSchema } from "@/validation/entities.schemas";
import { activateAcademicYearCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const activateAcademicYearRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/activateAcademicYear",
  tags: ["Setup Commands"],
  summary: "Activate Academic Year",
  request: {
    body: jsonContent(activateAcademicYearCommandSchema, "Activate Academic Year payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      academicYearResponseSchema,
      "Successfully executed Activate Academic Year",
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

export const activateAcademicYearHandler: AppRouteHandler<typeof activateAcademicYearRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.activateAcademicYear>[0];

  try {
    const result = await headlessApp.setup.activateAcademicYear(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
