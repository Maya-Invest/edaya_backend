import type { AppRouteHandler } from "@/lib/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http/responses";
import { dispatchCoreCommand, serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { coreCommands } from "@/lib/school-api/registry";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { coreRouteErrorResponses, type SchoolApiRoutePair, validatedJson } from "./shared";
import { schoolApiPath } from "./paths";

export function buildCommandRoutes(): SchoolApiRoutePair[] {
  const pairs: SchoolApiRoutePair[] = [];

  coreCommands.forEach((commandConfig) => {
    const route = createRoute({
      method: "post",
      path: schoolApiPath("commands", commandConfig.publicName),
      tags: ["Core Commands"],
      summary: commandConfig.publicName,
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

      const service = c.get("schoolApp").forActor(actor);
      const payload = validatedJson(c);

      try {
        const result = await dispatchCoreCommand(service, commandConfig.methodName, payload);
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
