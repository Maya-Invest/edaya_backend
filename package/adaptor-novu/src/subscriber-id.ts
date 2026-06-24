import type { NotificationRecipient } from "@edaya/core";

export function buildNovuSubscriberId(recipient: NotificationRecipient): string {
  if (!recipient.subjectId) {
    throw new Error(`Notification recipient ${recipient.kind}:${recipient.id} is missing subjectId`);
  }
  return recipient.subjectId;
}

export function buildNovuSubscriberIds(
  recipients: readonly NotificationRecipient[],
): string[] {
  const seen = new Set<string>();
  const subscriberIds: string[] = [];

  for (const recipient of recipients) {
    if (!recipient.subjectId) {
      continue;
    }
    if (seen.has(recipient.subjectId)) {
      continue;
    }
    seen.add(recipient.subjectId);
    subscriberIds.push(recipient.subjectId);
  }

  return subscriberIds;
}
