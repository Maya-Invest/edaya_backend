import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { studentDisciplinaryActionResponseSchema } from "@/validation/entities.schemas";
import { applyDisciplinaryActionCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const applyDisciplinaryActionRoute = createRoute({
  method: "post",
  path: "/api/commands/behavior/applyDisciplinaryAction",
  tags: ["Behavior Commands"],
  summary: "Apply Disciplinary Action",
  request: {
    body: jsonContent(applyDisciplinaryActionCommandSchema, "Apply Disciplinary Action payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      studentDisciplinaryActionResponseSchema,
      "Successfully executed Apply Disciplinary Action",
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

export const applyDisciplinaryActionHandler: AppRouteHandler<typeof applyDisciplinaryActionRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.behavior.applyDisciplinaryAction>[0];

  try {
    const result = await headlessApp.behavior.applyDisciplinaryAction(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
