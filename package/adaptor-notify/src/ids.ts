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
