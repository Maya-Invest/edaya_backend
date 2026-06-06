import type { SchoolService } from "@edaya/core";
import { clearEffectiveGrantsCache, invalidateEffectiveGrantsCacheForStaff } from "@/lib/authorization-grants-cache";

export interface EntityReadService {
  list: (...args: any[]) => Promise<unknown[]>;
  findOne: (...args: any[]) => Promise<unknown | undefined>;
  count: (...args: any[]) => Promise<number>;
  findById: (id: string) => Promise<unknown | undefined>;
  findByIds: (ids: string[]) => Promise<unknown[]>;
}

export interface EntityWriteService {
  save: (entity: any) => Promise<void>;
  batchSave: (entities: any[]) => Promise<string[]>;
  delete: (id: string) => Promise<void>;
  batchDelete: (ids: string[]) => Promise<void>;
}

export type QueryEntityName = string;
export type ConfigCommandEntityName = string;

function hasFunction(value: unknown, key: string): boolean {
  return typeof value === "object"
    && value !== null
    && key in value
    && typeof (value as Record<string, unknown>)[key] === "function";
}

function isEntityReadService(value: unknown): value is EntityReadService {
  return hasFunction(value, "list")
    && hasFunction(value, "findOne")
    && hasFunction(value, "count")
    && hasFunction(value, "findById")
    && hasFunction(value, "findByIds");
}

function isEntityWriteService(value: unknown): value is EntityWriteService {
  return hasFunction(value, "save")
    && hasFunction(value, "batchSave")
    && hasFunction(value, "delete")
    && hasFunction(value, "batchDelete");
}

export function getEntityReadService(service: SchoolService, name: QueryEntityName): EntityReadService | null {
  const candidate = (service.baseService as unknown as Record<string, unknown>)[name];
  return isEntityReadService(candidate) ? candidate : null;
}

export function getEntityWriteService(service: SchoolService, name: ConfigCommandEntityName): EntityWriteService | null {
  const candidate = (service.baseService as unknown as Record<string, unknown>)[name];
  if (!isEntityWriteService(candidate)) {
    return null;
  }
  return withAuthorizationCacheInvalidation(name, candidate as EntityReadService & EntityWriteService);
}

function withAuthorizationCacheInvalidation(name: string, service: EntityReadService & EntityWriteService): EntityWriteService {
  if (name === "accessRoles") {
    return {
      save: async (entity) => {
        await service.save(entity);
        clearEffectiveGrantsCache();
      },
      batchSave: async (entities) => {
        const result = await service.batchSave(entities);
        clearEffectiveGrantsCache();
        return result;
      },
      delete: async (id) => {
        await service.delete(id);
        clearEffectiveGrantsCache();
      },
      batchDelete: async (ids) => {
        await service.batchDelete(ids);
        clearEffectiveGrantsCache();
      },
    };
  }

  if (name === "staffRoleAssignments") {
    return {
      save: async (entity) => {
        await service.save(entity);
        invalidateStaffGrant(entity);
      },
      batchSave: async (entities) => {
        const result = await service.batchSave(entities);
        entities.forEach(invalidateStaffGrant);
        return result;
      },
      delete: async (id) => {
        const existing = await service.findById(id);
        await service.delete(id);
        invalidateStaffGrant(existing);
      },
      batchDelete: async (ids) => {
        const existing = await service.findByIds?.(ids);
        await service.batchDelete(ids);
        existing?.forEach(invalidateStaffGrant);
      },
    };
  }

  if (name === "staffMembers" || name === "staffAssignments") {
    return {
      save: async (entity) => {
        await service.save(entity);
        invalidateStaffGrant(entity);
      },
      batchSave: async (entities) => {
        const result = await service.batchSave(entities);
        entities.forEach(invalidateStaffGrant);
        return result;
      },
      delete: async (id) => {
        const existing = await service.findById(id);
        await service.delete(id);
        invalidateStaffGrant(existing);
      },
      batchDelete: async (ids) => {
        const existing = await service.findByIds?.(ids);
        await service.batchDelete(ids);
        existing?.forEach(invalidateStaffGrant);
      },
    };
  }

  return service;
}

function invalidateStaffGrant(entity: unknown): void {
  const candidate = entity as { id?: unknown; staffId?: unknown; schoolId?: unknown } | undefined;
  const staffId = typeof candidate?.staffId === "string"
    ? candidate.staffId
    : typeof candidate?.id === "string" ? candidate.id : undefined;
  const schoolId = typeof candidate?.schoolId === "string" ? candidate.schoolId : undefined;
  if (staffId) {
    invalidateEffectiveGrantsCacheForStaff(staffId, schoolId);
  }
}
