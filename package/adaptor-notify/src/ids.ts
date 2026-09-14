import { createHash } from "node:crypto";

export const NOTIFY_PLATFORM_TENANT = "platform";

export function buildInvitationRecipientId(invitationId: string): string {
  return `invite:${invitationId}`;
}

export function buildAuthRecipientId(email: string): string {
  return `auth:${email.trim().toLowerCase()}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Namespace transport identity; application delivery IDs remain unchanged. */
export function buildNotifyJobId(kind: string, tenant: string, deliveryId: string): string {
  if (!kind || !tenant || !deliveryId)
    throw new Error("Notification identity requires kind, tenant and delivery ID");
  return `notify:${JSON.stringify([kind, tenant, deliveryId])}`;
}

/** Bounded, opaque provider identity shared with signed receipt validation. */
export function buildNotifyChannelId(jobId: string, subjectId: string, channel: string): string {
  return createHash("sha256").update(JSON.stringify([jobId, subjectId, channel])).digest("hex");
}
