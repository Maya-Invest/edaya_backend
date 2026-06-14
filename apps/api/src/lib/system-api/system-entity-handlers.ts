import type { AppBindings, AppRouteHandler } from "@/http/types";
import type { Context } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import {
  badRequestResponse,
  getErrorMessage,
  notFoundResponse,
  routeErrorResponse,
  unauthorizedResponse,
} from "@/http/responses";
import {
  isValidSystemActorSecret,
  resolveSystemActorSecret,
} from "@/http/system-actor-auth";
import { getEntityReadService, getEntityWriteService } from "@/lib/school-api/dispatch/entities";
import type { CoreEntityConfig } from "@/lib/school-api/registry";
import type { SystemEntityContext } from "@/lib/system-api/schemas";
import { createSystemActorMetadata } from "@edaya/core";
import { randomUUID } from "node:crypto";

export function assertSystemActorAccess(c: Context<AppBindings>): Response | null {
  if (!resolveSystemActorSecret(c.env)) {
    return c.json({ message: "System actor routes are disabled" }, HttpStatusCodes.SERVICE_UNAVAILABLE);
  }

  if (!isValidSystemActorSecret(c.env, c.req.header("x-system-actor-secret"))) {
    return unauthorizedResponse(c);
  }

  return null;
}

function resolveSystemEntityServices(
  c: Context<AppBindings>,
  entityConfig: CoreEntityConfig,
  context: SystemEntityContext,
) {
  const actor = createSystemActorMetadata({
    schoolId: context.schoolId,
    systemId: context.systemId,
    reason: context.reason,
    requestId: c.req.header("x-request-id")?.trim() || randomUUID(),
  });
  const service = c.get("schoolApp").forActor(actor);
  return {
    readService: getEntityReadService(service, entityConfig.serviceName),
    writeService: getEntityWriteService(service, entityConfig.serviceName),
  };
}

export function systemEntityListHandler(entityConfig: CoreEntityConfig): AppRouteHandler<any> {
  return async (c) => {
    const denied = assertSystemActorAccess(c);
    if (denied) {
      return denied;
    }

    const body = await c.req.json() as SystemEntityContext & { query?: Record<string, unknown> };
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
  };
}

export function systemEntityOneHandler(entityConfig: CoreEntityConfig): AppRouteHandler<any> {
  return async (c) => {
    const denied = assertSystemActorAccess(c);
    if (denied) {
      return denied;
    }

    const body = await c.req.json() as SystemEntityContext & { query?: Record<string, unknown> };
    const { readService } = resolveSystemEntityServices(c, entityConfig, body);
    if (!readService) {
      return badRequestResponse(c, `Entity ${entityConfig.serviceName} is not readable`);
    }

    try {
      const result = await readService.findOne(body.query ?? {});
      return result
        ? c.json(result, HttpStatusCodes.OK)
        : notFoundResponse(c, `${entityConfig.displayName} not found`);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

export function systemEntityGetHandler(entityConfig: CoreEntityConfig): AppRouteHandler<any> {
  return async (c) => {
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

    const { readService } = resolveSystemEntityServices(c, entityConfig, { schoolId, systemId, reason });
    if (!readService) {
      return badRequestResponse(c, `Entity ${entityConfig.serviceName} is not readable`);
    }

    try {
      const result = await readService.findById(entityId);
      return result
        ? c.json(result, HttpStatusCodes.OK)
        : notFoundResponse(c, `${entityConfig.displayName} not found`);
    }
    catch (err) {
      return routeErrorResponse(c, err);
    }
  };
}

export function systemEntitySaveHandler(entityConfig: CoreEntityConfig): AppRouteHandler<any> {
  return async (c) => {
    const denied = assertSystemActorAccess(c);
    if (denied) {
      return denied;
    }

    const body = await c.req.json() as SystemEntityContext & { entity: Record<string, unknown> };
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
  };
}
