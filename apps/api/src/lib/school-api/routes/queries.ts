import type { AppRouteHandler } from "@/lib/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/lib/http/responses";
import { coreQueries } from "@/lib/school-api/registry";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { coreRouteErrorResponses, type SchoolApiRoutePair, validatedJson } from "./shared";

export function buildQueryRoutes(): SchoolApiRoutePair[] {
  const pairs: SchoolApiRoutePair[] = [];

  coreQueries.forEach((queryConfig) => {
    const route = createRoute({
      method: "post",
      path: `/api/core/queries/${queryConfig.publicName}`,
      tags: ["Core Queries"],
      summary: queryConfig.publicName,
      request: {
        body: jsonContent(queryConfig.requestSchema, `${queryConfig.publicName} payload`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(queryConfig.responseSchema, `Resolved ${queryConfig.publicName}`),
        ...coreRouteErrorResponses,
      },
    });

    const handler: AppRouteHandler<typeof route> = async (c) => {
      const actor = c.get("actor");
      if (!actor) {
        return unauthorizedResponse(c);
      }

      const service = c.get("schoolApp").forActor(actor);
      const { schoolId } = validatedJson(c) as { schoolId: string };

      try {
        const count = await service[queryConfig.methodName](schoolId);
        return c.json({ count }, HttpStatusCodes.OK);
      }
      catch (err) {
        return routeErrorResponse(c, err);
      }
    };

    pairs.push({ route, handler });
  });

  return pairs;
}
