import { scheduleNotificationRecipientBackfillForActor } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import type { AppRouteHandler } from "@/http/types";
import { getErrorMessage, unauthorizedResponse } from "@/http/responses";
import { requireInteractiveActor, serializeActorAuthorization } from "@/lib/authorization/serialize-grants";
import { scopeGrantResponseSchema } from "@/lib/school-api/schemas/entities";
import { schoolApiPath } from "@/lib/school-api/routes/paths";

const commandMessageSchema = createMessageObjectSchema();

const effectiveGrantsResponseSchema = z.object({
  kind: z.enum(["staff", "guardian", "student"]),
  actorId: z.string(),
  schoolId: z.string(),
  assuranceLevel: z.enum(["standard", "verified", "strong", "service"]),
  effectiveGrants: z.object({
    permissions: z.array(z.string()),
    scopeGrants: z.array(scopeGrantResponseSchema),
    isElevated: z.boolean(),
    expiresAt: z.string().datetime().optional(),
  }),
}).openapi("EffectiveGrantsResponse");

export const getEffectiveGrantsRoute = createRoute({
  method: "get",
  path: schoolApiPath("authorization", "effective-grants"),
  tags: ["Core Authorization"],
  summary: "Get current actor effective grants",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(effectiveGrantsResponseSchema, "Current actor authorization snapshot"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "System actors cannot introspect grants"),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
  },
});

export const getEffectiveGrantsHandler: AppRouteHandler<typeof getEffectiveGrantsRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const interactiveActor = requireInteractiveActor(actor);
  if (!interactiveActor) {
    return c.json({ message: "System actors cannot introspect grants" }, HttpStatusCodes.FORBIDDEN);
  }

  try {
    const service = c.get("schoolApp").forActor(interactiveActor);
    scheduleNotificationRecipientBackfillForActor(service.baseService, interactiveActor);

    return c.json(serializeActorAuthorization(interactiveActor), HttpStatusCodes.OK);
  }
  catch (err) {
    return c.json({ message: getErrorMessage(err) }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
