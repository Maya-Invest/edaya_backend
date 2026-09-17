import type { AccountInvitationKind } from '@edaya/core'

export function invitationLifecycleLockKey(
  schoolId: string,
  kind: AccountInvitationKind | string,
  targetId: string,
): string {
  return `account-invitation:${schoolId}:${kind}:${targetId}`
}
