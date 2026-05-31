import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { academicYearResponseSchema } from "@/validation/entities.schemas";
import { createAcademicYearCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createAcademicYearRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/createAcademicYear",
  tags: ["Setup Commands"],
  summary: "Create Academic Year",
  request: {
    body: jsonContent(createAcademicYearCommandSchema, "Create Academic Year payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      academicYearResponseSchema,
      "Successfully executed Create Academic Year",
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

export const createAcademicYearHandler: AppRouteHandler<typeof createAcademicYearRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.createAcademicYear>[0];

  try {
    const result = await headlessApp.setup.createAcademicYear(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
