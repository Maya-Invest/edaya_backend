import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { randomUUID } from "node:crypto";
import type { AppBindings, AppRouteHandler } from "@/lib/http/types";
import type { Context } from "hono";
import {
  badRequestResponse,
  getErrorMessage,
  notFoundResponse,
  routeErrorResponse,
  unauthorizedResponse,
} from "@/lib/http/responses";
import {
  isValidSystemActorSecret,
  resolveSystemActorSecret,
} from "@/lib/http/system-actor-auth";
import { getEntityReadService, getEntityWriteService } from "@/lib/school-api/dispatch/entities";
import { coreEntities, type CoreEntityConfig } from "@/lib/school-api/registry";
import { coreRouteErrorResponses, type SchoolApiRoutePair } from "@/lib/school-api/routes/shared";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { arraySchema } from "@/lib/school-api/schemas/helpers";
import { createSystemActorMetadata } from "@edaya/core";

const commandMessageSchema = createMessageObjectSchema();

const systemEntityIdParamSchema = z.object({
  id: z.string().min(1),
}).openapi("SystemEntityIdParam");

const systemEntityContextSchema = z.object({
  schoolId: z.string().min(1),
  systemId: z.string().min(1),
  reason: z.string().min(1),
}).openapi("SystemEntityContext");

const systemEntityListRequestSchema = systemEntityContextSchema.extend({
  query: z.record(z.string(), z.any()).optional(),
}).openapi("SystemEntityListRequest");

const systemEntityOneRequestSchema = systemEntityContextSchema.extend({
  query: z.record(z.string(), z.any()).optional(),
}).openapi("SystemEntityOneRequest");

const systemEntitySaveRequestSchema = systemEntityContextSchema.extend({
  entity: z.record(z.string(), z.any()),
}).openapi("SystemEntitySaveRequest");

function resolveSystemEntityServices(
  c: Context<AppBindings>,
  entityConfig: CoreEntityConfig,
  body: z.infer<typeof systemEntityContextSchema>,
) {
  const actor = createSystemActorMetadata({
    schoolId: body.schoolId,
    systemId: body.systemId,
    reason: body.reason,
    requestId: c.req.header("x-request-id")?.trim() || randomUUID(),
  });
  const service = c.get("schoolApp").forActor(actor);
  return {
    readService: getEntityReadService(service, entityConfig.serviceName),
    writeService: getEntityWriteService(service, entityConfig.serviceName),
  };
}

function assertSystemActorAccess(c: Context<AppBindings>): Response | null {
  if (!resolveSystemActorSecret(c.env)) {
    return c.json({ message: "System actor routes are disabled" }, HttpStatusCodes.SERVICE_UNAVAILABLE);
  }

  if (!isValidSystemActorSecret(c.env, c.req.header("x-system-actor-secret"))) {
    return unauthorizedResponse(c);
  }

  return null;
}

export function buildSystemEntityRoutes(): SchoolApiRoutePair[] {
  const pairs: SchoolApiRoutePair[] = [];

  for (const entityConfig of coreEntities) {
    const listRoute = createRoute({
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
    });

    pairs.push({
      route: listRoute,
      handler: (async (c) => {
        const denied = assertSystemActorAccess(c);
        if (denied) {
          return denied;
        }

        const body = await c.req.json() as z.infer<typeof systemEntityListRequestSchema>;
        const { readService } = resolveSystemEntityServices(c, entityConfig, body);
        if (!readService) {
          return badRequestResponse(c, `Entity ${entityConfig.serviceName} is not readable`);
        }

        try {
          return c.json(await readService.list(body.query ?? {}), HttpStatusCodes.OK);
        }
        catch (err) {
          return routeErrorResponse(c, err);
        }
      }) as AppRouteHandler<any>,
    });

    const oneRoute = createRoute({
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
    });

    pairs.push({
      route: oneRoute,
      handler: (async (c) => {
        const denied = assertSystemActorAccess(c);
        if (denied) {
          return denied;
        }

        const body = await c.req.json() as z.infer<typeof systemEntityOneRequestSchema>;
        const { readService } = resolveSystemEntityServices(c, entityConfig, body);
        if (!readService) {
          return badRequestResponse(c, `Entity ${entityConfig.serviceName} is not readable`);
        }

        try {
          const result = await readService.findOne(body.query ?? {});
          return result ? c.json(result, HttpStatusCodes.OK) : notFoundResponse(c, `${entityConfig.displayName} not found`);
        }
        catch (err) {
          return routeErrorResponse(c, err);
        }
      }) as AppRouteHandler<any>,
    });

    const getRoute = createRoute({
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
    });

    pairs.push({
      route: getRoute,
      handler: (async (c) => {
        const denied = assertSystemActorAccess(c);
        if (denied) {
          return denied;
        }

        const entityId = c.req.param("id");
        if (!entityId) {
          return badRequestResponse(c, "id is required");
        }

        const schoolId = c.req.query("schoolId");
        const systemId = c.req.query("systemId");
        const reason = c.req.query("reason");
        if (!schoolId || !systemId || !reason) {
          return badRequestResponse(c, "schoolId, systemId and reason query parameters are required");
        }

        const actor = createSystemActorMetadata({
          schoolId,
          systemId,
          reason,
          requestId: c.req.header("x-request-id")?.trim() || randomUUID(),
        });
        const service = c.get("schoolApp").forActor(actor);
        const readService = getEntityReadService(service, entityConfig.serviceName);
        if (!readService) {
          return badRequestResponse(c, `Entity ${entityConfig.serviceName} is not readable`);
        }

        try {
          const result = await readService.findById(entityId);
          return result ? c.json(result, HttpStatusCodes.OK) : notFoundResponse(c, `${entityConfig.displayName} not found`);
        }
        catch (err) {
          return routeErrorResponse(c, err);
        }
      }) as AppRouteHandler<any>,
    });

    const saveRoute = createRoute({
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
    });

    pairs.push({
      route: saveRoute,
      handler: (async (c) => {
        const denied = assertSystemActorAccess(c);
        if (denied) {
          return denied;
        }

        const body = await c.req.json() as z.infer<typeof systemEntitySaveRequestSchema>;
        const { writeService } = resolveSystemEntityServices(c, entityConfig, body);
        if (!writeService) {
          return badRequestResponse(c, `Entity ${entityConfig.serviceName} is not writable`);
        }

        let entity: unknown;
        try {
          entity = entityConfig.createEntity(body.entity);
        }
        catch (err) {
          return badRequestResponse(c, getErrorMessage(err));
        }

        try {
          await writeService.save(entity);
          return c.json(entity as Record<string, unknown>, HttpStatusCodes.OK);
        }
        catch (err) {
          return routeErrorResponse(c, err);
        }
      }) as AppRouteHandler<any>,
    });
  }

  return pairs;
}
