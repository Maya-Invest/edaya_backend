import type { AppBindings, AppRouteHandler } from "@/http/types";
import { badRequestResponse, getErrorMessage, methodNotAllowedResponse, notFoundResponse, routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import type { Context } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { getEntityReadService, getEntityWriteService } from "@/lib/school-api/dispatch/entities";
import type { CoreEntityConfig } from "@/lib/school-api/registry";
import { validatedJson, validatedParam } from "./shared";

export function resolveServices(c: Context<AppBindings>, serviceName: string) {
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

export function entityListHandler(serviceName: string): AppRouteHandler<any> {
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

export function entityOneHandler(serviceName: string, displayName: string): AppRouteHandler<any> {
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

export function entityCountHandler(serviceName: string): AppRouteHandler<any> {
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

export function entityGetHandler(serviceName: string, displayName: string): AppRouteHandler<any> {
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

export function entitySaveHandler(entityConfig: Pick<CoreEntityConfig, "serviceName" | "displayName" | "createEntity" | "allowDirectSave">): AppRouteHandler<any> {
  return async (c) => {
    const { actor, writeService } = resolveServices(c, entityConfig.serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!entityConfig.allowDirectSave) {
      return methodNotAllowedResponse(c, `Use a domain command to save ${entityConfig.displayName}`);
    }
    if (!writeService)
      return badRequestResponse(c, `Entity ${entityConfig.serviceName} is not writable`);
    let entity: unknown;
    try {
      entity = entityConfig.createEntity(validatedJson(c) as Record<string, unknown>);
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

export function entityDeleteHandler(serviceName: string): AppRouteHandler<any> {
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

export function entityBatchSaveHandler(entityConfig: Pick<CoreEntityConfig, "serviceName" | "displayName" | "createEntity" | "allowDirectSave">): AppRouteHandler<any> {
  return async (c) => {
    const { actor, writeService } = resolveServices(c, entityConfig.serviceName);
    if (!actor)
      return unauthorizedResponse(c);
    if (!entityConfig.allowDirectSave) {
      return methodNotAllowedResponse(c, `Use a domain command to save ${entityConfig.displayName}`);
    }
    if (!writeService)
      return badRequestResponse(c, `Entity ${entityConfig.serviceName} is not writable`);
    let constructed: unknown[];
    try {
      const { entities } = validatedJson(c) as { entities: Record<string, unknown>[] };
      constructed = entities.map(entityConfig.createEntity);
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

export function entityBatchDeleteHandler(serviceName: string): AppRouteHandler<any> {
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
