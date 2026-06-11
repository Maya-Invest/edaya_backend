import type { SchoolService } from "@edaya/core";
import type { coreCommands } from "@/lib/school-api/registry";

export type CoreCommandMethodName = (typeof coreCommands)[number]["methodName"];

export function dispatchCoreCommand(
  service: SchoolService,
  methodName: CoreCommandMethodName,
  payload: unknown,
): Promise<unknown> {
  const candidate = service[methodName as keyof SchoolService];
  if (typeof candidate !== "function") {
    throw new TypeError(`Unsupported core command method: ${methodName}`);
  }

  return Promise.resolve((candidate as (input: unknown) => unknown).call(service, payload));
}

function unwrapDomainEntity(entity: unknown): unknown {
  if (
    entity
    && typeof entity === "object"
    && "data" in entity
    && entity.data
    && typeof entity.data === "object"
  ) {
    return entity.data;
  }

  return entity;
}

export function serializeCommandResult(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  if ("kind" in result && "entity" in result) {
    return {
      kind: result.kind,
      entity: unwrapDomainEntity(result.entity),
    };
  }

  return unwrapDomainEntity(result);
}
