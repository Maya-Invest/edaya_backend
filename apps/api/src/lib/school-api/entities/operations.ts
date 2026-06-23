import type { ActorMetadata, CoreEntityKey } from "@edaya/core";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { getEntityReadService, getEntityWriteService } from "@/lib/school-api/dispatch/entities";
import type { CoreEntityConfig } from "@/lib/school-api/registry";

export class EntityOperationError extends Error {
  constructor(
    readonly code:
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "NOT_READABLE"
      | "NOT_WRITABLE"
      | "METHOD_NOT_ALLOWED"
      | "BAD_REQUEST",
    message: string,
  ) {
    super(message);
    this.name = "EntityOperationError";
  }
}

function requireActor(actor: ActorMetadata | null | undefined): ActorMetadata {
  if (!actor) {
    throw new EntityOperationError("UNAUTHORIZED", "Missing or invalid authorization session");
  }
  return actor;
}

function resolveServices(actor: ActorMetadata, schoolApp: ApiSchoolApplication, serviceName: CoreEntityKey) {
  const service = schoolApp.forActor(actor);
  return {
    readService: getEntityReadService(service, serviceName),
    writeService: getEntityWriteService(service, serviceName),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function countFilter(filter: unknown): Record<string, unknown> {
  const next = { ...asRecord(filter) };
  delete next.$orderBy;
  delete next.$limit;
  delete next.$offset;
  return next;
}

export async function executeEntityList(
  actor: ActorMetadata | null | undefined,
  schoolApp: ApiSchoolApplication,
  serviceName: CoreEntityKey,
  filter: unknown,
) {
  const resolvedActor = requireActor(actor);
  const { readService } = resolveServices(resolvedActor, schoolApp, serviceName);
  if (!readService) {
    throw new EntityOperationError("NOT_READABLE", `Entity ${serviceName} is not readable`);
  }
  return readService.list(filter ?? {});
}

export async function executeEntityOne(
  actor: ActorMetadata | null | undefined,
  schoolApp: ApiSchoolApplication,
  serviceName: CoreEntityKey,
  displayName: string,
  filter: unknown,
) {
  const resolvedActor = requireActor(actor);
  const { readService } = resolveServices(resolvedActor, schoolApp, serviceName);
  if (!readService) {
    throw new EntityOperationError("NOT_READABLE", `Entity ${serviceName} is not readable`);
  }
  const result = await readService.findOne(filter ?? {});
  if (!result) {
    throw new EntityOperationError("NOT_FOUND", `${displayName} not found`);
  }
  return result;
}

export async function executeEntityCount(
  actor: ActorMetadata | null | undefined,
  schoolApp: ApiSchoolApplication,
  serviceName: CoreEntityKey,
  filter: unknown,
) {
  const resolvedActor = requireActor(actor);
  const { readService } = resolveServices(resolvedActor, schoolApp, serviceName);
  if (!readService) {
    throw new EntityOperationError("NOT_READABLE", `Entity ${serviceName} is not readable`);
  }
  return readService.count(countFilter(filter));
}

export async function executeEntityGet(
  actor: ActorMetadata | null | undefined,
  schoolApp: ApiSchoolApplication,
  serviceName: CoreEntityKey,
  displayName: string,
  id: string,
) {
  const resolvedActor = requireActor(actor);
  const { readService } = resolveServices(resolvedActor, schoolApp, serviceName);
  if (!readService) {
    throw new EntityOperationError("NOT_READABLE", `Entity ${serviceName} is not readable`);
  }
  const result = await readService.findById(id);
  if (!result) {
    throw new EntityOperationError("NOT_FOUND", `${displayName} not found`);
  }
  return result;
}

export async function executeEntitySave(
  actor: ActorMetadata | null | undefined,
  schoolApp: ApiSchoolApplication,
  entityConfig: Pick<CoreEntityConfig, "serviceName" | "displayName" | "createEntity" | "allowDirectSave">,
  input: unknown,
) {
  requireActor(actor);
  if (!entityConfig.allowDirectSave) {
    throw new EntityOperationError(
      "METHOD_NOT_ALLOWED",
      `Use a domain command to save ${entityConfig.displayName}`,
    );
  }
  const { writeService } = resolveServices(requireActor(actor), schoolApp, entityConfig.serviceName);
  if (!writeService) {
    throw new EntityOperationError("NOT_WRITABLE", `Entity ${entityConfig.serviceName} is not writable`);
  }

  let entity: unknown;
  try {
    entity = entityConfig.createEntity(asRecord(input));
  }
  catch (err) {
    throw new EntityOperationError("BAD_REQUEST", err instanceof Error ? err.message : "Invalid entity payload");
  }

  await writeService.save(entity);
  return entity;
}

export async function executeEntityDelete(
  actor: ActorMetadata | null | undefined,
  schoolApp: ApiSchoolApplication,
  serviceName: CoreEntityKey,
  id: string,
) {
  const resolvedActor = requireActor(actor);
  const { writeService } = resolveServices(resolvedActor, schoolApp, serviceName);
  if (!writeService) {
    throw new EntityOperationError("NOT_WRITABLE", `Entity ${serviceName} is not writable`);
  }
  await writeService.delete(id);
  return { message: `${serviceName} ${id} deleted` };
}

export async function executeEntityBatchSave(
  actor: ActorMetadata | null | undefined,
  schoolApp: ApiSchoolApplication,
  entityConfig: Pick<CoreEntityConfig, "serviceName" | "displayName" | "createEntity" | "allowDirectSave">,
  entities: unknown,
) {
  requireActor(actor);
  if (!entityConfig.allowDirectSave) {
    throw new EntityOperationError(
      "METHOD_NOT_ALLOWED",
      `Use a domain command to save ${entityConfig.displayName}`,
    );
  }
  const { writeService } = resolveServices(requireActor(actor), schoolApp, entityConfig.serviceName);
  if (!writeService) {
    throw new EntityOperationError("NOT_WRITABLE", `Entity ${entityConfig.serviceName} is not writable`);
  }

  const payload = asRecord(entities);
  const rows = Array.isArray(payload.entities) ? payload.entities : [];
  let constructed: unknown[];
  try {
    constructed = rows.map(row => entityConfig.createEntity(asRecord(row)));
  }
  catch (err) {
    throw new EntityOperationError("BAD_REQUEST", err instanceof Error ? err.message : "Invalid entity payload");
  }

  const ids = await writeService.batchSave(constructed);
  return { ids };
}

export async function executeEntityBatchDelete(
  actor: ActorMetadata | null | undefined,
  schoolApp: ApiSchoolApplication,
  serviceName: CoreEntityKey,
  ids: readonly string[],
) {
  const resolvedActor = requireActor(actor);
  const { writeService } = resolveServices(resolvedActor, schoolApp, serviceName);
  if (!writeService) {
    throw new EntityOperationError("NOT_WRITABLE", `Entity ${serviceName} is not writable`);
  }
  await writeService.batchDelete([...ids]);
  return { message: `${serviceName} batch deleted` };
}
