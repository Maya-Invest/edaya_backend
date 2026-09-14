import type { NotifyRecipientRow } from "../store/types";

export type NotifySendChannel = "email" | "push" | "sms";

export function resolveSendChannels(
  recipient: Pick<NotifyRecipientRow, "email" | "phone" | "allows_notifications" | "channel_email" | "channel_push" | "channel_sms"> | undefined,
  options: { channels?: readonly NotifySendChannel[] } = {},
): NotifySendChannel[] {
  if (!recipient || recipient.allows_notifications === false) {
    return [];
  }
  const allowed = options.channels ?? ["email", "push", "sms"];
  const channels: NotifySendChannel[] = [];
  if (allowed.includes("email") && recipient.channel_email !== false && recipient.email) {
    channels.push("email");
  }
  if (allowed.includes("push") && recipient.channel_push) {
    channels.push("push");
  }
  if (allowed.includes("sms") && recipient.channel_sms && recipient.phone) {
    channels.push("sms");
  }
  return channels;
}
