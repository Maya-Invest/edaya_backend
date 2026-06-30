import type { GetSchoolOverviewInput } from "@edaya/core";
import type { AppRouteHandler } from "@/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { coreQueries } from "@/lib/school-api/registry";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { coreRouteErrorResponses, type SchoolApiRoutePair, validatedJson } from "./shared";
import { schoolApiPath } from "./paths";

export function buildQueryRoutes(): SchoolApiRoutePair[] {
  const pairs: SchoolApiRoutePair[] = [];

  coreQueries.forEach((queryConfig) => {
    const route = createRoute({
      method: "post",
      path: schoolApiPath("queries", queryConfig.publicName),
      tags: ["Core Queries"],
      summary: queryConfig.publicName,
      ...queryRouteOperation(queryConfig),
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
      const payload = validatedJson(c) as Record<string, unknown>;

      try {
        if (queryConfig.methodName === "getSchoolOverview") {
          const input: GetSchoolOverviewInput = {
            schoolId: payload.schoolId as string,
            academicYearId: payload.academicYearId as string,
            academicPeriodId: payload.academicPeriodId as string,
            referenceDate: payload.referenceDate
              ? new Date(`${payload.referenceDate as string}T00:00:00.000Z`)
              : undefined,
          };
          const overview = await service.getSchoolOverview(input);
          return c.json(overview, HttpStatusCodes.OK);
        }

        const count = await service[queryConfig.methodName](payload.schoolId as string);
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
