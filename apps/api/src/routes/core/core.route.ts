import type { AppBindings, AppRouteHandler } from "@/lib/types";
import type { RouteConfig } from "@hono/zod-openapi";
import { badRequestResponse, getErrorMessage, notFoundResponse, routeErrorResponse, unauthorizedResponse } from "@/lib/http-responses";
import { getEntityReadService, getEntityWriteService } from "@/lib/service-accessors";
import { arraySchema } from "@/validation/utils/schema-fields";
import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { coreCommands, coreEntities, coreQueries } from "./core-registries";

export interface CoreRoutePair<R extends RouteConfig = any> {
  route: R;
  handler: AppRouteHandler<R>;
}

const idParamSchema = z.object({ id: z.string().min(1) }).openapi("CoreEntityIdParam");
const deleteEntitySchema = z.object({ id: z.string().min(1) }).openapi("CoreEntityDelete");
const entitySaveSchema = z.record(z.unknown()).openapi("CoreEntitySave");
const batchSaveSchema = z.object({
  entities: z.array(z.record(z.unknown())),
}).openapi("CoreEntityBatchSave");
const batchDeleteSchema = z.object({
  ids: z.array(z.string().min(1)),
}).openapi("CoreEntityBatchDelete");
const commandMessageSchema = createMessageObjectSchema();

export const coreRoutePairs: CoreRoutePair[] = [];

coreCommands.forEach((commandConfig) => {
  const route = createRoute({
    method: "post",
    path: `/api/core/commands/${commandConfig.publicName}`,
    tags: ["Core Commands"],
    summary: commandConfig.publicName,
    request: {
      body: jsonContent(commandConfig.requestSchema, `${commandConfig.publicName} payload`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(commandConfig.responseSchema, `Executed ${commandConfig.publicName}`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });

  const handler: AppRouteHandler<typeof route> = async (c) => {
    const actor = c.get("actor");
    if (!actor) {
      return unauthorizedResponse(c);
    }

    const service = c.get("schoolApp").forActor(actor);
    const payload = validatedJson(c);
    const method = (service as unknown as Record<string, unknown>)[commandConfig.methodName] as (input: unknown) => Promise<unknown>;

    try {
      const result = await method.call(service, payload);
      return c.json(result ?? { message: `${commandConfig.publicName} completed` }, HttpStatusCodes.OK);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };

  coreRoutePairs.push({ route, handler });
});

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
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
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

  coreRoutePairs.push({ route, handler });
});

coreEntities.forEach((entityConfig) => {
  const listRoute = createRoute({
    method: "post",
    path: `/api/core/entities/${entityConfig.publicName}/list`,
    tags: ["Core Entities"],
    summary: `List ${entityConfig.displayName}`,
    request: {
      body: jsonContent(entityConfig.querySchema, `${entityConfig.displayName} query`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(arraySchema(entityConfig.responseSchema), `Listed ${entityConfig.displayName}`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });
  coreRoutePairs.push({ route: listRoute, handler: entityListHandler(entityConfig.serviceName) });

  const oneRoute = createRoute({
    method: "post",
    path: `/api/core/entities/${entityConfig.publicName}/one`,
    tags: ["Core Entities"],
    summary: `Find one ${entityConfig.displayName}`,
    request: {
      body: jsonContent(entityConfig.querySchema, `${entityConfig.displayName} query`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Found ${entityConfig.displayName}`),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, `${entityConfig.displayName} not found`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });
  coreRoutePairs.push({ route: oneRoute, handler: entityOneHandler(entityConfig.serviceName, entityConfig.displayName) });

  const countRoute = createRoute({
    method: "post",
    path: `/api/core/entities/${entityConfig.publicName}/count`,
    tags: ["Core Entities"],
    summary: `Count ${entityConfig.displayName}`,
    request: {
      body: jsonContent(entityConfig.querySchema, `${entityConfig.displayName} query`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(z.object({ count: z.number() }), `Counted ${entityConfig.displayName}`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });
  coreRoutePairs.push({ route: countRoute, handler: entityCountHandler(entityConfig.serviceName) });

  const getRoute = createRoute({
    method: "get",
    path: `/api/core/entities/${entityConfig.publicName}/{id}`,
    tags: ["Core Entities"],
    summary: `Get ${entityConfig.displayName}`,
    request: {
      params: idParamSchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Fetched ${entityConfig.displayName}`),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, `${entityConfig.displayName} not found`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });
  coreRoutePairs.push({ route: getRoute, handler: entityGetHandler(entityConfig.serviceName, entityConfig.displayName) });

  const saveRoute = createRoute({
    method: "post",
    path: `/api/core/entities/${entityConfig.publicName}/save`,
    tags: ["Core Entities"],
    summary: `Save ${entityConfig.displayName}`,
    request: {
      body: jsonContent(entitySaveSchema, `${entityConfig.displayName} entity`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(entityConfig.responseSchema, `Saved ${entityConfig.displayName}`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(commandMessageSchema, "Invalid entity payload"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });
  coreRoutePairs.push({ route: saveRoute, handler: entitySaveHandler(entityConfig.serviceName, entityConfig.createEntity) });

  const deleteRoute = createRoute({
    method: "post",
    path: `/api/core/entities/${entityConfig.publicName}/delete`,
    tags: ["Core Entities"],
    summary: `Delete ${entityConfig.displayName}`,
    request: {
      body: jsonContent(deleteEntitySchema, `${entityConfig.displayName} delete request`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(commandMessageSchema, `Deleted ${entityConfig.displayName}`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });
  coreRoutePairs.push({ route: deleteRoute, handler: entityDeleteHandler(entityConfig.serviceName) });

  const batchSaveRoute = createRoute({
    method: "post",
    path: `/api/core/entities/${entityConfig.publicName}/batch-save`,
    tags: ["Core Entities"],
    summary: `Batch save ${entityConfig.displayName}`,
    request: {
      body: jsonContent(batchSaveSchema, `${entityConfig.displayName} batch save request`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(z.object({ ids: z.array(z.string()) }), `Batch saved ${entityConfig.displayName}`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(commandMessageSchema, "Invalid entity payload"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });
  coreRoutePairs.push({ route: batchSaveRoute, handler: entityBatchSaveHandler(entityConfig.serviceName, entityConfig.createEntity) });

  const batchDeleteRoute = createRoute({
    method: "post",
    path: `/api/core/entities/${entityConfig.publicName}/batch-delete`,
    tags: ["Core Entities"],
    summary: `Batch delete ${entityConfig.displayName}`,
    request: {
      body: jsonContent(batchDeleteSchema, `${entityConfig.displayName} batch delete request`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(commandMessageSchema, `Batch deleted ${entityConfig.displayName}`),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
    },
  });
  coreRoutePairs.push({ route: batchDeleteRoute, handler: entityBatchDeleteHandler(entityConfig.serviceName) });
});

function resolveServices(c: Context<AppBindings>, serviceName: string) {
  const actor = c.get("actor");
  if (!actor) {
    return { actor: null, readService: null, writeService: null };
  }
  const service = c.get("schoolApp").forActor(actor);
  return {
    actor,
    readService: getEntityReadService(service, serviceName),
    writeService: getEntityWriteService(service, serviceName),
  };
}

function entityListHandler(serviceName: string): AppRouteHandler<any> {
  return async (c) => {
    const { actor, readService } = resolveServices(c, serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!readService)
      return badRequestResponse(c, `Entity ${serviceName} is not readable`);
    try {
      return c.json(await readService.list(validatedJson(c)), HttpStatusCodes.OK);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

function entityOneHandler(serviceName: string, displayName: string): AppRouteHandler<any> {
  return async (c) => {
    const { actor, readService } = resolveServices(c, serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!readService)
      return badRequestResponse(c, `Entity ${serviceName} is not readable`);
    try {
      const result = await readService.findOne(validatedJson(c));
      return result ? c.json(result, HttpStatusCodes.OK) : notFoundResponse(c, `${displayName} not found`);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

function entityCountHandler(serviceName: string): AppRouteHandler<any> {
  return async (c) => {
    const { actor, readService } = resolveServices(c, serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!readService)
      return badRequestResponse(c, `Entity ${serviceName} is not readable`);
    try {
      const filter = { ...(validatedJson(c) as Record<string, unknown>) };
      delete filter.$orderBy;
      delete filter.$limit;
      delete filter.$offset;
      return c.json({ count: await readService.count(filter) }, HttpStatusCodes.OK);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

function entityGetHandler(serviceName: string, displayName: string): AppRouteHandler<any> {
  return async (c) => {
    const { actor, readService } = resolveServices(c, serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!readService)
      return badRequestResponse(c, `Entity ${serviceName} is not readable`);
    try {
      const { id } = validatedParam(c) as { id: string };
      const result = await readService.findById(id);
      return result ? c.json(result, HttpStatusCodes.OK) : notFoundResponse(c, `${displayName} not found`);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

function entitySaveHandler(serviceName: string, createEntity: (body: Record<string, unknown>) => unknown): AppRouteHandler<any> {
  return async (c) => {
    const { actor, writeService } = resolveServices(c, serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!writeService)
      return badRequestResponse(c, `Entity ${serviceName} is not writable`);
    let entity: unknown;
    try {
      entity = createEntity(validatedJson(c) as Record<string, unknown>);
    }
    catch (err) {
      return badRequestResponse(c, getErrorMessage(err));
    }
    try {
      await writeService.save(entity);
      return c.json(entity as any, HttpStatusCodes.OK);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

function entityDeleteHandler(serviceName: string): AppRouteHandler<any> {
  return async (c) => {
    const { actor, writeService } = resolveServices(c, serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!writeService)
      return badRequestResponse(c, `Entity ${serviceName} is not writable`);
    try {
      const { id } = validatedJson(c) as { id: string };
      await writeService.delete(id);
      return c.json({ message: `${serviceName} ${id} deleted` }, HttpStatusCodes.OK);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

function entityBatchSaveHandler(serviceName: string, createEntity: (body: Record<string, unknown>) => unknown): AppRouteHandler<any> {
  return async (c) => {
    const { actor, writeService } = resolveServices(c, serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!writeService)
      return badRequestResponse(c, `Entity ${serviceName} is not writable`);
    let constructed: unknown[];
    try {
      const { entities } = validatedJson(c) as { entities: Record<string, unknown>[] };
      constructed = entities.map(createEntity);
    }
    catch (err) {
      return badRequestResponse(c, getErrorMessage(err));
    }
    try {
      const ids = await writeService.batchSave(constructed);
      return c.json({ ids }, HttpStatusCodes.OK);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

function entityBatchDeleteHandler(serviceName: string): AppRouteHandler<any> {
  return async (c) => {
    const { actor, writeService } = resolveServices(c, serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!writeService)
      return badRequestResponse(c, `Entity ${serviceName} is not writable`);
    try {
      const { ids } = validatedJson(c) as { ids: string[] };
      await writeService.batchDelete(ids);
      return c.json({ message: `${serviceName} batch deleted` }, HttpStatusCodes.OK);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

function validatedJson(c: Context<AppBindings>): unknown {
  return (c.req as any).valid("json");
}

function validatedParam(c: Context<AppBindings>): unknown {
  return (c.req as any).valid("param");
}
