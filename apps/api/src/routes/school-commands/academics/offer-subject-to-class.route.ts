import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { classSubjectResponseSchema } from "@/validation/entities.schemas";
import { offerSubjectToClassCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const offerSubjectToClassRoute = createRoute({
  method: "post",
  path: "/api/commands/academics/offerSubjectToClass",
  tags: ["Academics Commands"],
  summary: "Offer Subject To Class",
  request: {
    body: jsonContent(offerSubjectToClassCommandSchema, "Offer Subject To Class payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      classSubjectResponseSchema,
      "Successfully executed Offer Subject To Class",
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

export const offerSubjectToClassHandler: AppRouteHandler<typeof offerSubjectToClassRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.academics.offerSubjectToClass>[0];

  try {
    const result = await headlessApp.academics.offerSubjectToClass(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
