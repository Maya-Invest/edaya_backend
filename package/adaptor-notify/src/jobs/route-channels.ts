import type { NotifyRecipientRow } from "../store/types";

export type NotifySendChannel = "email" | "push";

export function resolveSendChannels(
  recipient: NotifyRecipientRow | undefined,
  options: { emailOnly?: boolean } = {},
): NotifySendChannel[] {
  if (!recipient || recipient.allows_notifications === false) {
    return [];
  }
  const channels: NotifySendChannel[] = [];
  if (recipient.channel_email !== false && recipient.email) {
    channels.push("email");
  }
  if (!options.emailOnly && recipient.channel_push) {
    channels.push("push");
  }
  return channels;
}
