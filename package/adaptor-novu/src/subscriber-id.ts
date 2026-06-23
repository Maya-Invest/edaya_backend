import type { NotificationRecipient } from "@edaya/core";

export function buildNovuSubscriberId(
  schoolId: string,
  recipient: NotificationRecipient,
): string {
  return `${schoolId}:${recipient.kind}:${recipient.id}`;
}

export function buildNovuSubscriberIds(
  schoolId: string,
  recipients: readonly NotificationRecipient[],
): string[] {
  const seen = new Set<string>();
  const subscriberIds: string[] = [];

  for (const recipient of recipients) {
    const subscriberId = buildNovuSubscriberId(schoolId, recipient);
    if (seen.has(subscriberId)) {
      continue;
    }
    seen.add(subscriberId);
    subscriberIds.push(subscriberId);
  }

  return subscriberIds;
}
