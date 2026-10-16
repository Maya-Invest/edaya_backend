import type { AccountInvitationData } from "@edaya/core";
import type { SchoolCommandKey, SchoolService } from "@edaya/service";
import { toPublicAccountInvitationData } from "@edaya/core";
import { dispatchSchoolCommand } from "@edaya/service";

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

function serializeNestedEntities(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(serializeNestedEntities);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    const unwrapped = unwrapDomainEntity(value);
    // Only domain instances are unwrapped; retain dates and plain data envelopes.
    return unwrapped === value ? value : serializeNestedEntities(unwrapped);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, serializeNestedEntities(nested)]),
  );
}

export function serializeCommandResult(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.map(serializeCommandResult);
  }

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
    const invitation = result.invitation;
    const publicInvitation = invitation instanceof Object
      && invitation !== null
      && "data" in invitation
      && invitation.data
      && typeof invitation.data === "object"
      ? toPublicAccountInvitationData(invitation.data as AccountInvitationData)
      : invitation;

    return {
      invitation: publicInvitation,
      token: result.token,
    };
  }

  return serializeNestedEntities(unwrapDomainEntity(result));
}
