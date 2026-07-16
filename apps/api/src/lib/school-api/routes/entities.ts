import { coreEntities } from "@/lib/school-api/registry";
import { entityRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { arraySchema } from "@/lib/school-api/schemas/helpers";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import {
  entityBatchDeleteHandler,
  entityBatchSaveHandler,
  entityCountHandler,
  entityDeleteHandler,
  entityGetHandler,
  entityListHandler,
  entityOneHandler,
  entitySaveHandler,
} from "./entity-handlers";
import { coreRouteErrorResponses } from "./shared";
import type { SchoolApiRoutePair } from "./shared";
import { schoolApiPath } from "./paths";

const idParamSchema = z.object({ id: z.string().min(1) }).openapi("CoreEntityIdParam");
const deleteEntitySchema = z.object({ id: z.string().min(1) }).openapi("CoreEntityDelete");
const batchDeleteSchema = z.object({
  ids: z.array(z.string().min(1)),
}).openapi("CoreEntityBatchDelete");
const commandMessageSchema = createMessageObjectSchema();

export function buildEntityRoutes(): SchoolApiRoutePair[] {
  const pairs: SchoolApiRoutePair[] = [];

  coreEntities.forEach((entityConfig) => {
    const listRoute = createRoute({
      method: "post",
      path: schoolApiPath("entities", entityConfig.publicName, "list"),
      tags: ["Core Entities"],
      summary: `List ${entityConfig.displayName}`,
      ...entityRouteOperation(entityConfig, "list"),
      request: {
        body: jsonContent(entityConfig.querySchema, `${entityConfig.displayName} query`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(arraySchema(entityConfig.responseSchema), `Listed ${entityConfig.displayName}`),
        ...coreRouteErrorResponses,
      },
    });
    pairs.push({ route: listRoute, handler: entityListHandler(entityConfig.serviceName) });

    const oneRoute = createRoute({
      method: "post",
      path: schoolApiPath("entities", entityConfig.publicName, "one"),
      tags: ["Core Entities"],
      summary: `Find one ${entityConfig.displayName}`,
      ...entityRouteOperation(entityConfig, "one"),
      request: {
        body: jsonContent(entityConfig.querySchema, `${entityConfig.displayName} query`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Found ${entityConfig.displayName}`),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, `${entityConfig.displayName} not found`),
        ...coreRouteErrorResponses,
      },
    });
    pairs.push({ route: oneRoute, handler: entityOneHandler(entityConfig.serviceName, entityConfig.displayName) });

    const countRoute = createRoute({
      method: "post",
      path: schoolApiPath("entities", entityConfig.publicName, "count"),
      tags: ["Core Entities"],
      summary: `Count ${entityConfig.displayName}`,
      ...entityRouteOperation(entityConfig, "count"),
      request: {
        body: jsonContent(entityConfig.querySchema, `${entityConfig.displayName} query`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({ count: z.number() }), `Counted ${entityConfig.displayName}`),
        ...coreRouteErrorResponses,
      },
    });
    pairs.push({ route: countRoute, handler: entityCountHandler(entityConfig.serviceName) });

    const getRoute = createRoute({
      method: "get",
      path: schoolApiPath("entities", entityConfig.publicName, "{id}"),
      tags: ["Core Entities"],
      summary: `Get ${entityConfig.displayName}`,
      ...entityRouteOperation(entityConfig, "get"),
      request: {
        params: idParamSchema,
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Fetched ${entityConfig.displayName}`),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, `${entityConfig.displayName} not found`),
        ...coreRouteErrorResponses,
      },
    });
    pairs.push({ route: getRoute, handler: entityGetHandler(entityConfig.serviceName, entityConfig.displayName) });

    const saveRoute = createRoute({
      method: "post",
      path: schoolApiPath("entities", entityConfig.publicName, "save"),
      tags: ["Core Entities"],
      summary: `Save ${entityConfig.displayName}`,
      ...entityRouteOperation(entityConfig, "save"),
      request: {
        body: jsonContent(entityConfig.saveSchema, `${entityConfig.displayName} entity`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Saved ${entityConfig.displayName}`),
        [HttpStatusCodes.METHOD_NOT_ALLOWED]: jsonContent(commandMessageSchema, "Use a domain command for this entity"),
        ...coreRouteErrorResponses,
      },
    });
    pairs.push({ route: saveRoute, handler: entitySaveHandler(entityConfig) });

    const deleteRoute = createRoute({
      method: "post",
      path: schoolApiPath("entities", entityConfig.publicName, "delete"),
      tags: ["Core Entities"],
      summary: `Delete ${entityConfig.displayName}`,
      ...entityRouteOperation(entityConfig, "delete"),
      request: {
        body: jsonContent(deleteEntitySchema, `${entityConfig.displayName} delete request`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(commandMessageSchema, `Deleted ${entityConfig.displayName}`),
        ...coreRouteErrorResponses,
      },
    });
    pairs.push({ route: deleteRoute, handler: entityDeleteHandler(entityConfig.serviceName) });

    const batchSaveRoute = createRoute({
      method: "post",
      path: schoolApiPath("entities", entityConfig.publicName, "batch-save"),
      tags: ["Core Entities"],
      summary: `Batch save ${entityConfig.displayName}`,
      ...entityRouteOperation(entityConfig, "batchSave"),
      request: {
        body: jsonContent(
          z.object({ entities: z.array(entityConfig.saveSchema) }).openapi(`${entityConfig.displayName.replaceAll(" ", "")}BatchSave`),
          `${entityConfig.displayName} batch save request`,
        ),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(z.object({ ids: z.array(z.string()) }), `Batch saved ${entityConfig.displayName}`),
        [HttpStatusCodes.METHOD_NOT_ALLOWED]: jsonContent(commandMessageSchema, "Use a domain command for this entity"),
        ...coreRouteErrorResponses,
      },
    });
    pairs.push({ route: batchSaveRoute, handler: entityBatchSaveHandler(entityConfig) });

    const batchDeleteRoute = createRoute({
      method: "post",
      path: schoolApiPath("entities", entityConfig.publicName, "batch-delete"),
      tags: ["Core Entities"],
      summary: `Batch delete ${entityConfig.displayName}`,
      ...entityRouteOperation(entityConfig, "batchDelete"),
      request: {
        body: jsonContent(batchDeleteSchema, `${entityConfig.displayName} batch delete request`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(commandMessageSchema, `Batch deleted ${entityConfig.displayName}`),
        ...coreRouteErrorResponses,
      },
    });
    pairs.push({ route: batchDeleteRoute, handler: entityBatchDeleteHandler(entityConfig.serviceName) });
  });

  return pairs;
}
