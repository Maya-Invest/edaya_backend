import type { CoreEntityKey } from "@edaya/service";
import type { Context } from "hono";
import type { AppBindings, AppRouteHandler } from "@/http/types";
import type { CoreEntityConfig } from "@/lib/school-api/registry";
import { dispatchAutoBilling } from "@edaya/service";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { badRequestResponse, getErrorMessage, methodNotAllowedResponse, notFoundResponse, routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import {
  EntityOperationError,
  executeEntityBatchDelete,
  executeEntityBatchSave,
  executeEntityCount,
  executeEntityDelete,
  executeEntityGet,
  executeEntityList,
  executeEntityOne,
  executeEntitySave,
} from "@/lib/school-api/entities/operations";
import { scheduleBackgroundApplicationTask } from "@/lib/school-api/schedule-background-task";
import { validatedJson, validatedParam } from "./shared";

function mapEntityOperationError(c: Context<AppBindings>, err: unknown) {
  if (err instanceof EntityOperationError) {
    switch (err.code) {
      case "UNAUTHORIZED":
        return unauthorizedResponse(c);
      case "NOT_FOUND":
        return notFoundResponse(c, err.message);
      case "METHOD_NOT_ALLOWED":
        return methodNotAllowedResponse(c, err.message);
      case "BAD_REQUEST":
      case "NOT_READABLE":
      case "NOT_WRITABLE":
        return badRequestResponse(c, err.message);
      default:
        return routeErrorResponse(c, err);
    }
  }
  return routeErrorResponse(c, err);
}

export function resolveServices(c: Context<AppBindings>, _serviceName: CoreEntityKey) {
  const actor = c.get("actor");
  if (!actor) {
    return { actor: null, schoolApp: null };
  }
  return {
    actor,
    schoolApp: c.get("schoolApp"),
  };
}

export function entityListHandler(serviceName: CoreEntityKey): AppRouteHandler<any> {
  return async (c) => {
    const { actor, schoolApp } = resolveServices(c, serviceName);
    try {
      const result = await executeEntityList(actor, schoolApp!, serviceName, validatedJson(c));
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (err) {
      return mapEntityOperationError(c, err);
    }
  };
}

export function entityOneHandler(serviceName: CoreEntityKey, displayName: string): AppRouteHandler<any> {
  return async (c) => {
    const { actor, schoolApp } = resolveServices(c, serviceName);
    try {
      const result = await executeEntityOne(actor, schoolApp!, serviceName, displayName, validatedJson(c));
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (err) {
      return mapEntityOperationError(c, err);
    }
  };
}

export function entityCountHandler(serviceName: CoreEntityKey): AppRouteHandler<any> {
  return async (c) => {
    const { actor, schoolApp } = resolveServices(c, serviceName);
    try {
      const count = await executeEntityCount(actor, schoolApp!, serviceName, validatedJson(c));
      return c.json({ count }, HttpStatusCodes.OK);
    }
    catch (err) {
      return mapEntityOperationError(c, err);
    }
  };
}

export function entityGetHandler(serviceName: CoreEntityKey, displayName: string): AppRouteHandler<any> {
  return async (c) => {
    const { actor, schoolApp } = resolveServices(c, serviceName);
    try {
      const { id } = validatedParam(c) as { id: string };
      const result = await executeEntityGet(actor, schoolApp!, serviceName, displayName, id);
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (err) {
      return mapEntityOperationError(c, err);
    }
  };
}

export function entitySaveHandler(entityConfig: Pick<CoreEntityConfig, "serviceName" | "displayName" | "createEntity" | "publicOperations">): AppRouteHandler<any> {
  return async (c) => {
    const { actor, schoolApp } = resolveServices(c, entityConfig.serviceName);
    try {
      const entity = await executeEntitySave(actor, schoolApp!, entityConfig, validatedJson(c));
      if (["catalogServices", "enrollments", "studentAcademicYearProfiles", "classGroups"].includes(entityConfig.serviceName))
        scheduleBackgroundApplicationTask(c, application => dispatchAutoBilling(application));
      return c.json(entity, HttpStatusCodes.OK);
    }
    catch (err) {
      if (err instanceof EntityOperationError && err.code === "BAD_REQUEST") {
        return badRequestResponse(c, getErrorMessage(err));
      }
      return mapEntityOperationError(c, err);
    }
  };
}

export function entityDeleteHandler(serviceName: CoreEntityKey): AppRouteHandler<any> {
  return async (c) => {
    const { actor, schoolApp } = resolveServices(c, serviceName);
    try {
      const { id } = validatedJson(c) as { id: string };
      const result = await executeEntityDelete(actor, schoolApp!, serviceName, id);
      if (["enrollments", "studentAcademicYearProfiles"].includes(serviceName))
        scheduleBackgroundApplicationTask(c, application => dispatchAutoBilling(application));
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (err) {
      return mapEntityOperationError(c, err);
    }
  };
}

export function entityBatchSaveHandler(entityConfig: Pick<CoreEntityConfig, "serviceName" | "displayName" | "createEntity" | "publicOperations">): AppRouteHandler<any> {
  return async (c) => {
    const { actor, schoolApp } = resolveServices(c, entityConfig.serviceName);
    try {
      const result = await executeEntityBatchSave(actor, schoolApp!, entityConfig, validatedJson(c));
      if (["catalogServices", "enrollments", "studentAcademicYearProfiles", "classGroups"].includes(entityConfig.serviceName))
        scheduleBackgroundApplicationTask(c, application => dispatchAutoBilling(application));
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (err) {
      if (err instanceof EntityOperationError && err.code === "BAD_REQUEST") {
        return badRequestResponse(c, getErrorMessage(err));
      }
      return mapEntityOperationError(c, err);
    }
  };
}

export function entityBatchDeleteHandler(serviceName: CoreEntityKey): AppRouteHandler<any> {
  return async (c) => {
    const { actor, schoolApp } = resolveServices(c, serviceName);
    try {
      const { ids } = validatedJson(c) as { ids: string[] };
      const result = await executeEntityBatchDelete(actor, schoolApp!, serviceName, ids);
      if (["enrollments", "studentAcademicYearProfiles"].includes(serviceName))
        scheduleBackgroundApplicationTask(c, application => dispatchAutoBilling(application));
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (err) {
      return mapEntityOperationError(c, err);
    }
  };
}
