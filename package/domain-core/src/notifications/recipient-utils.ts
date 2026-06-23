import type { NotificationRecipient } from '../ports/notification-gateway'

export function uniqueNotificationRecipients(
  recipients: readonly NotificationRecipient[],
): NotificationRecipient[] {
  const seen = new Map<string, NotificationRecipient>()
  for (const recipient of recipients) {
    seen.set(`${recipient.kind}:${recipient.id}`, recipient)
  }
  return [...seen.values()]
}
