import type { NotificationRecipientProfile } from "@edaya/core";
import type { CreateSubscriberRequestDto } from "@novu/api/models/components";

export function mapRecipientProfileToNovuSubscriber(
  subscriberId: string,
  schoolId: string,
  profile: NotificationRecipientProfile,
): CreateSubscriberRequestDto {
  return {
    subscriberId,
    firstName: profile.displayName?.split(" ")[0] ?? undefined,
    lastName: profile.displayName?.split(" ").slice(1).join(" ") || undefined,
    email: profile.email ?? undefined,
    phone: profile.phone ?? undefined,
    locale: profile.locale ?? undefined,
    data: {
      schoolId,
      recipientKind: profile.recipient.kind,
      recipientId: profile.recipient.id,
      preferences: profile.preferences,
    },
  };
}
