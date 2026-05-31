import type { AppRouteHandler } from "@/lib/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { attachmentResponseSchema } from "@/validation/entities.schemas";
import { registerAttachmentCommandSchema } from "@/validation/commands.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const registerAttachmentRoute = createRoute({
  method: "post",
  path: "/api/commands/setup/registerAttachment",
  tags: ["Setup Commands"],
  summary: "Register Attachment",
  request: {
    body: jsonContent(registerAttachmentCommandSchema, "Register Attachment payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      attachmentResponseSchema,
      "Successfully executed Register Attachment",
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

export const registerAttachmentHandler: AppRouteHandler<typeof registerAttachmentRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const payload = c.req.valid("json") as Parameters<typeof headlessApp.setup.registerAttachment>[0];

  try {
    const result = await headlessApp.setup.registerAttachment(payload);
    return c.json(result as any, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
