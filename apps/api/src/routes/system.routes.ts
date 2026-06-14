import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { randomUUID } from "node:crypto";
import type { AppRouteHandler } from "@/lib/http/types";
import { badRequestResponse, routeErrorResponse, unauthorizedResponse } from "@/lib/http/responses";
import {
  isValidSystemActorSecret,
  resolveSystemActorSecret,
} from "@/lib/http/system-actor-auth";
import { dispatchCoreCommand } from "@/lib/school-api/dispatch/commands";
import { coreCommands } from "@/lib/school-api/registry";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { createSystemActorMetadata } from "@edaya/core";

const commandMessageSchema = createMessageObjectSchema();

const systemCommandParamSchema = z.object({
  commandName: z.string().min(1),
}).openapi("SystemCommandNameParam");

const systemCommandRequestSchema = z.object({
  schoolId: z.string().min(1),
  systemId: z.string().min(1),
  reason: z.string().min(1),
  payload: z.record(z.unknown()),
}).openapi("SystemCommandRequest");

export const systemCommandRoute = createRoute({
  method: "post",
  path: schoolApiPath("system", "commands", "{commandName}"),
  tags: ["Core System"],
  summary: "Execute a core command as a system actor",
  request: {
    params: systemCommandParamSchema,
    body: jsonContent(systemCommandRequestSchema, "System command request"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.record(z.unknown()).openapi("SystemCommandResponse"), "Executed system command"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, "Unknown command"),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(commandMessageSchema, "System actor routes are disabled"),
    ...coreRouteErrorResponses,
  },
});

export const systemCommandHandler: AppRouteHandler<typeof systemCommandRoute> = async (c) => {
  const configuredSecret = resolveSystemActorSecret(c.env);
  if (!configuredSecret) {
    return c.json({ message: "System actor routes are disabled" }, HttpStatusCodes.SERVICE_UNAVAILABLE);
  }

  if (!isValidSystemActorSecret(c.env, c.req.header("x-system-actor-secret"))) {
    return unauthorizedResponse(c);
  }

  const { commandName } = c.req.valid("param");
  const commandConfig = coreCommands.find(command => command.publicName === commandName);
  if (!commandConfig) {
    return c.json({ message: `Unknown command: ${commandName}` }, HttpStatusCodes.NOT_FOUND);
  }

  const body = c.req.valid("json");
  const actor = createSystemActorMetadata({
    schoolId: body.schoolId,
    systemId: body.systemId,
    reason: body.reason,
    requestId: c.req.header("x-request-id")?.trim() || randomUUID(),
  });

  try {
    const service = c.get("schoolApp").forActor(actor);
    const result = await dispatchCoreCommand(service, commandConfig.methodName, body.payload);
    return c.json(result ?? { message: `${commandName} completed` }, HttpStatusCodes.OK);
  }
  catch (err) {
    if (err instanceof Error && err.message.startsWith("Unsupported core command method:")) {
      return badRequestResponse(c, err.message);
    }
    return routeErrorResponse(c, err);
  }
};
