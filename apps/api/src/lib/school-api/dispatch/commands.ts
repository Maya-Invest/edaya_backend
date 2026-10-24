import type { AccountInvitationData } from "@edaya/core";
import type { SchoolCommandKey, SchoolService } from "@edaya/service";
import { toPublicAccountInvitationData } from "@edaya/core";
import { dispatchSchoolCommand } from "@edaya/service";
import { serializeNestedEntities, unwrapDomainEntity } from "../serialization";

export type CoreCommandMethodName = SchoolCommandKey;

export function dispatchCoreCommand(
  service: SchoolService,
  methodName: SchoolCommandKey,
  payload: unknown,
): Promise<unknown> {
  return dispatchSchoolCommand(service.commands, methodName, payload);
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
      entity: serializeNestedEntities(unwrapDomainEntity(result.entity)),
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
