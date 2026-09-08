import type { InvitationDeliveryInput, InvitationDeliveryPort } from "@edaya/core";
import { deliverInvitation, revokeInvitation } from "./operations";
import type { NotifyRuntime } from "./runtime";

export function createNotifyInvitationDeliveryPort(runtime: NotifyRuntime): InvitationDeliveryPort {
  return {
    deliver: async (input: InvitationDeliveryInput) => {
      await deliverInvitation(runtime, input);
    },
    revoke: async (invitationId: string) => {
      await revokeInvitation(runtime, invitationId);
    },
  };
}
