export function buildTransientInvitationSubscriberId(invitationId: string): string {
  return `invite:${invitationId}`
}
