import type { AppRouteHandler } from "@/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { executeSchoolCommand } from "@/lib/school-api/execute-command";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { coreCommands } from "@/lib/school-api/registry";
import { commandRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { assertCommandActorKind } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { coreRouteErrorResponses, type SchoolApiRoutePair, validatedJson } from "./shared";
import { schoolApiPath } from "./paths";
import { resolveInviteBaseUrl } from "@/runtime/shared/env/derived";
import type { SchoolCommandKey } from "@edaya/core";

const INVITATION_COMMANDS = new Set<SchoolCommandKey>([
  "sendAccountInvitation",
  "resendAccountInvitation",
]);

function enrichCommandPayload(
  methodName: SchoolCommandKey,
  payload: Record<string, unknown>,
  inviteBaseUrl: string | undefined,
): Record<string, unknown> {
  if (!INVITATION_COMMANDS.has(methodName) || !inviteBaseUrl) {
    return payload;
  }

  return {
    ...payload,
    inviteBaseUrl,
  };
}

export function buildCommandRoutes(): SchoolApiRoutePair[] {
  const pairs: SchoolApiRoutePair[] = [];

  coreCommands.forEach((commandConfig) => {
    const route = createRoute({
      method: "post",
      path: schoolApiPath("commands", commandConfig.publicName),
      tags: ["Core Commands"],
      summary: commandConfig.publicName,
      ...commandRouteOperation(commandConfig),
      request: {
        body: jsonContent(commandConfig.requestSchema, `${commandConfig.publicName} payload`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(commandConfig.responseSchema, `Executed ${commandConfig.publicName}`),
        ...coreRouteErrorResponses,
      },
    });

    const handler: AppRouteHandler<typeof route> = async (c) => {
      const actor = c.get("actor");
      if (!actor) {
        return unauthorizedResponse(c);
      }

      try {
        assertCommandActorKind(actor, { serviceOnly: commandConfig.serviceOnly });
      }
      catch (err) {
        return routeErrorResponse(c, err);
      }

      const service = c.get("schoolApp").forActor(actor);
      const payload = validatedJson(c) as Record<string, unknown>;
      const inviteBaseUrl = resolveInviteBaseUrl(c.env);

      try {
        const result = await executeSchoolCommand(
          c,
          service,
          commandConfig.methodName,
          enrichCommandPayload(commandConfig.methodName, payload, inviteBaseUrl),
        );
        if (result === undefined || result === null) {
          return c.json({ message: `${commandConfig.publicName} completed` }, HttpStatusCodes.OK);
        }
        return c.json(serializeCommandResult(result) as Record<string, unknown>, HttpStatusCodes.OK);
      }
      catch (err) {
        return routeErrorResponse(c, err);
      }
    };

    pairs.push({ route, handler });
  });

  return pairs;
}
