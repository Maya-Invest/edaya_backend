import type { SchoolCommandKey, SchoolService } from "@edaya/core";
import { dispatchSchoolCommand } from "@edaya/core";

export type CoreCommandMethodName = SchoolCommandKey;

export function dispatchCoreCommand(
  service: SchoolService,
  methodName: SchoolCommandKey,
  payload: unknown,
): Promise<unknown> {
  return dispatchSchoolCommand(service.commands, methodName, payload);
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

  if ("invitation" in result && "token" in result) {
    return {
      invitation: unwrapDomainEntity(result.invitation),
      token: result.token,
    };
  }

  return unwrapDomainEntity(result);
}
