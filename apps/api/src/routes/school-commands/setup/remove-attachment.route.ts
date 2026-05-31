import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { commandMessageResponseSchema } from "@/validation/command-response.schemas";
import { removeAttachmentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const removeAttachmentRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/removeAttachment",
  tags: ["Setup Commands"],
  summary: "Remove Attachment",
  request: {
    body: jsonContent(removeAttachmentCommandSchema, "Remove Attachment payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      commandMessageResponseSchema,
      "Successfully executed Remove Attachment",
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

export const removeAttachmentHandler: AppRouteHandler<typeof removeAttachmentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.removeAttachment>[0];

  try {
    await headlessApp.setup.removeAttachment(payload);
    return c.json({ message: "setup.removeAttachment completed" }, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
