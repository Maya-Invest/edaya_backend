import type { InvitationDeliveryInput, InvitationDeliveryPort } from "@edaya/core";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import { ACCOUNT_INVITATION_EVENT_KEY, buildTransientInvitationSubscriberId } from "@edaya/service";
import type { NovuSubscriberClient } from "./novu-subscriber-client";
import { createNovuSdkClient } from "./novu-sdk-client";
import { createNovuSubscriberClient } from "./novu-subscriber-client";
import type { NovuTriggerClient } from "./types";

function mapActorKindToRecipientKind(
  actorKind: InvitationDeliveryInput["actorKind"],
): MessageDeliveryRecipientKind {
  if (actorKind === "staff") {
    return MessageDeliveryRecipientKind.Staff;
  }
  if (actorKind === "guardian") {
    return MessageDeliveryRecipientKind.Guardian;
  }
  return MessageDeliveryRecipientKind.Student;
}

export interface CreateNovuInvitationDeliveryPortOptions {
  subscriberClient: NovuSubscriberClient;
  triggerClient: NovuTriggerClient;
}

export function createNovuInvitationDeliveryPort(
  options: CreateNovuInvitationDeliveryPortOptions,
): InvitationDeliveryPort {
  return {
    deliver: async (input: InvitationDeliveryInput) => {
      const subscriberId = buildTransientInvitationSubscriberId(input.invitationId);
      await options.subscriberClient.upsert(
        subscriberId,
        input.schoolId,
        {
          schoolId: input.schoolId,
          recipient: {
            kind: mapActorKindToRecipientKind(input.actorKind),
            id: input.invitationId,
          },
          displayName: input.displayName,
          email: input.contactChannel === "email" ? input.contactValue : undefined,
          phone: input.contactChannel === "phone" ? input.contactValue : undefined,
          preferences: {
            allowsNotifications: true,
            channels: {
              email: input.contactChannel === "email",
              sms: input.contactChannel === "phone",
            },
          },
        },
        { skipWorkflowPreferences: true },
      );

      await options.triggerClient.trigger({
        workflowId: ACCOUNT_INVITATION_EVENT_KEY,
        to: subscriberId,
        transactionId: input.invitationId,
        context: {
          tenant: input.schoolId,
        },
        payload: {
          title: input.emailSubject,
          body: input.emailBody,
          emailSubject: input.emailSubject,
          emailBody: input.emailBody,
          kind: "event",
          eventKey: ACCOUNT_INVITATION_EVENT_KEY,
          schoolId: input.schoolId,
          metadata: {
            inviteUrl: input.inviteUrl,
            actorKind: input.actorKind,
            expiresAt: input.expiresAt.toISOString(),
          },
        },
      });
    },
    revoke: async (invitationId: string) => {
      await options.subscriberClient.remove(buildTransientInvitationSubscriberId(invitationId));
    },
  };
}

export function createNovuInvitationDeliveryPortFromSecretKey(options: {
  secretKey: string;
  serverURL?: string;
}): InvitationDeliveryPort {
  return createNovuInvitationDeliveryPort({
    subscriberClient: createNovuSubscriberClient(options),
    triggerClient: createNovuSdkClient(options),
  });
}
