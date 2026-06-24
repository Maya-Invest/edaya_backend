import type { AccountInvitationKind } from '../domains/access/account-invitation'

export interface InvitationDeliveryInput {
  invitationId: string
  schoolId: string
  contactChannel: 'email' | 'phone'
  contactValue: string
  displayName: string
  actorKind: AccountInvitationKind
  inviteUrl: string
  expiresAt: Date
}

/** Delivers invite messages via transient Novu subscribers (pre-account). */
export interface InvitationDeliveryPort {
  deliver: (input: InvitationDeliveryInput) => Promise<void>
  revoke: (invitationId: string) => Promise<void>
}
