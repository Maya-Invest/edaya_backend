import type { AccountInvitationData, SchoolCommandKey, SchoolService } from "@edaya/core";
import { dispatchSchoolCommand, toPublicAccountInvitationData } from "@edaya/core";

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

  return unwrapDomainEntity(result);
}
