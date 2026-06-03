import type { ApiSchoolServiceFacade } from "@/lib/school-service-facade";

export interface EntityReadService {
  list: (...args: any[]) => Promise<unknown[]>;
  findOne: (...args: any[]) => Promise<unknown | undefined>;
  count: (...args: any[]) => Promise<number>;
  findById: (id: string) => Promise<unknown | undefined>;
}

export interface EntityWriteService {
  save: (entity: any) => Promise<void>;
  delete: (id: string) => Promise<void>;
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
    && hasFunction(value, "findById");
}

function isEntityWriteService(value: unknown): value is EntityWriteService {
  return hasFunction(value, "save") && hasFunction(value, "delete");
}

export function getEntityReadService(queries: ApiSchoolServiceFacade["queries"], name: QueryEntityName): EntityReadService | null {
  const candidate = queries[name];
  return isEntityReadService(candidate) ? candidate : null;
}

export function getEntityWriteService(config: ApiSchoolServiceFacade["config"], name: ConfigCommandEntityName): EntityWriteService | null {
  const candidate = config[name];
  return isEntityWriteService(candidate) ? candidate : null;
}
