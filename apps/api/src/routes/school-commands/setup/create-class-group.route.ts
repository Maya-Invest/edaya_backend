import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { classGroupResponseSchema } from "@/validation/entities.schemas";
import { createClassGroupCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const createClassGroupRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/createClassGroup",
  tags: ["Setup Commands"],
  summary: "Create Class Group",
  request: {
    body: jsonContent(createClassGroupCommandSchema, "Create Class Group payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      classGroupResponseSchema,
      "Successfully executed Create Class Group",
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

export const createClassGroupHandler: AppRouteHandler<typeof createClassGroupRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.createClassGroup>[0];

  try {
    const result = await headlessApp.setup.createClassGroup(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
