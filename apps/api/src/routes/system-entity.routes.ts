import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { coreEntities } from "@/lib/school-api/registry";
import { coreRouteErrorResponses, type SchoolApiRoutePair } from "@/lib/school-api/routes/shared";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { arraySchema } from "@/lib/school-api/schemas/helpers";
import {
  systemEntityContextSchema,
  systemEntityIdParamSchema,
  systemEntityListRequestSchema,
  systemEntityOneRequestSchema,
  systemEntitySaveRequestSchema,
} from "@/lib/system-api/schemas";
import {
  systemEntityGetHandler,
  systemEntityListHandler,
  systemEntityOneHandler,
  systemEntitySaveHandler,
} from "@/lib/system-api/system-entity-handlers";

const commandMessageSchema = createMessageObjectSchema();

export function buildSystemEntityRoutes(): SchoolApiRoutePair[] {
  const pairs: SchoolApiRoutePair[] = [];

  for (const entityConfig of coreEntities) {
    pairs.push({
      route: createRoute({
        method: "post",
        path: schoolApiPath("system", "entities", entityConfig.publicName, "list"),
        tags: ["Core System"],
        summary: `List ${entityConfig.displayName} as a system actor`,
        request: {
          body: jsonContent(systemEntityListRequestSchema, `${entityConfig.displayName} query`),
        },
        responses: {
          [HttpStatusCodes.OK]: jsonContent(arraySchema(entityConfig.responseSchema), `Listed ${entityConfig.displayName}`),
          [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, "Unknown entity"),
          [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(commandMessageSchema, "System actor routes are disabled"),
          ...coreRouteErrorResponses,
        },
      }),
      handler: systemEntityListHandler(entityConfig),
    });

    pairs.push({
      route: createRoute({
        method: "post",
        path: schoolApiPath("system", "entities", entityConfig.publicName, "one"),
        tags: ["Core System"],
        summary: `Find one ${entityConfig.displayName} as a system actor`,
        request: {
          body: jsonContent(systemEntityOneRequestSchema, `${entityConfig.displayName} query`),
        },
        responses: {
          [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Found ${entityConfig.displayName}`),
          [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, `${entityConfig.displayName} not found`),
          [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(commandMessageSchema, "System actor routes are disabled"),
          ...coreRouteErrorResponses,
        },
      }),
      handler: systemEntityOneHandler(entityConfig),
    });

    pairs.push({
      route: createRoute({
        method: "get",
        path: schoolApiPath("system", "entities", entityConfig.publicName, "{id}"),
        tags: ["Core System"],
        summary: `Get ${entityConfig.displayName} by id as a system actor`,
        request: {
          params: systemEntityIdParamSchema,
          query: systemEntityContextSchema,
        },
        responses: {
          [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Fetched ${entityConfig.displayName}`),
          [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, `${entityConfig.displayName} not found`),
          [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(commandMessageSchema, "System actor routes are disabled"),
          ...coreRouteErrorResponses,
        },
      }),
      handler: systemEntityGetHandler(entityConfig),
    });

    pairs.push({
      route: createRoute({
        method: "post",
        path: schoolApiPath("system", "entities", entityConfig.publicName, "save"),
        tags: ["Core System"],
        summary: `Save ${entityConfig.displayName} as a system actor`,
        request: {
          body: jsonContent(systemEntitySaveRequestSchema, `${entityConfig.displayName} entity`),
        },
        responses: {
          [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Saved ${entityConfig.displayName}`),
          [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, "Unknown entity"),
          [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(commandMessageSchema, "System actor routes are disabled"),
          ...coreRouteErrorResponses,
        },
      }),
      handler: systemEntitySaveHandler(entityConfig),
    });
  }

  return pairs;
}
