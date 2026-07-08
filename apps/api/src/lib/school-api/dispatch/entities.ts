import type { CoreEntityKey, SchoolService } from "@edaya/school-service";

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

export function getEntityReadService(service: SchoolService, name: CoreEntityKey): EntityReadService | null {
  const candidate = service.baseService.entities?.[name];
  return isEntityReadService(candidate) ? candidate : null;
}

export function getEntityWriteService(service: SchoolService, name: CoreEntityKey): EntityWriteService | null {
  const candidate = service.baseService.entities?.[name];
  return isEntityWriteService(candidate) ? candidate : null;
}
