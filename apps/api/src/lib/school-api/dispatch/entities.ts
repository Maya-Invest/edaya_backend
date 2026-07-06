import type { CoreEntityKey, SchoolService } from "@edaya/core";
import {
  invalidateEffectiveGrantsCacheForActor,
  invalidateEffectiveGrantsCacheForStaff,
} from "@/lib/authorization/grants-cache/resolve-cached";
import { invalidateActorScopeCacheForActor } from "@/lib/authorization/scope-cache/resolve-cached";

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

export type QueryEntityName = CoreEntityKey;
export type ConfigCommandEntityName = CoreEntityKey;

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
  const candidate = service.baseService.entities?.[name];
  return isEntityReadService(candidate) ? candidate : null;
}

export function getEntityWriteService(service: SchoolService, name: ConfigCommandEntityName): EntityWriteService | null {
  const candidate = service.baseService.entities?.[name];
  if (!isEntityWriteService(candidate)) {
    return null;
  }
  return withAuthorizationCacheInvalidation(name, candidate as EntityReadService & EntityWriteService);
}

function withAuthorizationCacheInvalidation(name: string, service: EntityReadService & EntityWriteService): EntityWriteService {
  if (name === "staffPermissionAssignments") {
    return wrapWriteService(service, {
      afterSave: entity => invalidateStaffGrant(entity),
      afterBatchSave: entities => entities.forEach(invalidateStaffGrant),
      afterDelete: entity => invalidateStaffGrant(entity),
      afterBatchDelete: entities => entities?.forEach(invalidateStaffGrant),
    });
  }

  if (name === "staffMembers" || name === "staffAssignments") {
    return wrapWriteService(service, {
      afterSave: entity => invalidateStaffGrant(entity),
      afterBatchSave: entities => entities.forEach(invalidateStaffGrant),
      afterDelete: entity => invalidateStaffGrant(entity),
      afterBatchDelete: entities => entities?.forEach(invalidateStaffGrant),
    });
  }

  if (name === "guardianLinks") {
    return wrapWriteService(service, {
      afterSave: entity => invalidateGuardianLinkGrants(entity),
      afterBatchSave: entities => entities.forEach(invalidateGuardianLinkGrants),
      afterDelete: entity => invalidateGuardianLinkGrants(entity),
      afterBatchDelete: entities => entities?.forEach(invalidateGuardianLinkGrants),
    });
  }

  if (name === "enrollments") {
    return wrapWriteService(service, {
      afterSave: entity => invalidateStudentGrant(entity),
      afterBatchSave: entities => entities.forEach(invalidateStudentGrant),
      afterDelete: entity => invalidateStudentGrant(entity),
      afterBatchDelete: entities => entities?.forEach(invalidateStudentGrant),
    });
  }

  if (name === "students") {
    return wrapWriteService(service, {
      afterSave: entity => invalidateStudentGrant(entity),
      afterBatchSave: entities => entities.forEach(invalidateStudentGrant),
      afterDelete: entity => invalidateStudentGrant(entity),
      afterBatchDelete: entities => entities?.forEach(invalidateStudentGrant),
    });
  }

  if (name === "guardians") {
    return wrapWriteService(service, {
      afterSave: entity => invalidateGuardianGrant(entity),
      afterBatchSave: entities => entities.forEach(invalidateGuardianGrant),
      afterDelete: entity => invalidateGuardianGrant(entity),
      afterBatchDelete: entities => entities?.forEach(invalidateGuardianGrant),
    });
  }

  if (name === "teachers" || name === "teacherAssignments") {
    return wrapWriteService(service, {
      afterSave: entity => invalidateTeacherGrant(entity),
      afterBatchSave: entities => entities.forEach(invalidateTeacherGrant),
      afterDelete: entity => invalidateTeacherGrant(entity),
      afterBatchDelete: entities => entities?.forEach(invalidateTeacherGrant),
    });
  }

  return service;
}

interface WriteInvalidationHooks {
  afterSave?: (entity: unknown) => void;
  afterBatchSave?: (entities: unknown[]) => void;
  afterDelete?: (entity: unknown) => void;
  afterBatchDelete?: (entities: unknown[] | undefined) => void;
}

function wrapWriteService(
  service: EntityReadService & EntityWriteService,
  hooks: WriteInvalidationHooks,
): EntityWriteService {
  return {
    save: async (entity) => {
      await service.save(entity);
      hooks.afterSave?.(entity);
    },
    batchSave: async (entities) => {
      const result = await service.batchSave(entities);
      hooks.afterBatchSave?.(entities);
      return result;
    },
    delete: async (id) => {
      const existing = await service.findById(id);
      await service.delete(id);
      hooks.afterDelete?.(existing);
    },
    batchDelete: async (ids) => {
      const existing = await service.findByIds?.(ids);
      await service.batchDelete(ids);
      hooks.afterBatchDelete?.(existing);
    },
  };
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

function invalidateStudentGrant(entity: unknown): void {
  const candidate = entity as { id?: unknown; studentId?: unknown; schoolId?: unknown } | undefined;
  const studentId = typeof candidate?.studentId === "string"
    ? candidate.studentId
    : typeof candidate?.id === "string" ? candidate.id : undefined;
  const schoolId = typeof candidate?.schoolId === "string" ? candidate.schoolId : undefined;
  if (studentId) {
    invalidateEffectiveGrantsCacheForActor(studentId, "student", schoolId);
  }
}

function invalidateGuardianGrant(entity: unknown): void {
  const candidate = entity as { id?: unknown; guardianId?: unknown; schoolId?: unknown } | undefined;
  const guardianId = typeof candidate?.guardianId === "string"
    ? candidate.guardianId
    : typeof candidate?.id === "string" ? candidate.id : undefined;
  const schoolId = typeof candidate?.schoolId === "string" ? candidate.schoolId : undefined;
  if (guardianId) {
    invalidateEffectiveGrantsCacheForActor(guardianId, "guardian", schoolId);
  }
}

function invalidateGuardianLinkGrants(entity: unknown): void {
  invalidateGuardianGrant(entity);
  invalidateStudentGrant(entity);
}

function invalidateTeacherGrant(entity: unknown): void {
  const candidate = entity as { id?: unknown; teacherId?: unknown; schoolId?: unknown } | undefined;
  const teacherId = typeof candidate?.teacherId === "string"
    ? candidate.teacherId
    : typeof candidate?.id === "string" ? candidate.id : undefined;
  const schoolId = typeof candidate?.schoolId === "string" ? candidate.schoolId : undefined;
  if (teacherId) {
    invalidateActorScopeCacheForActor(teacherId, "teacher", schoolId);
  }
}
