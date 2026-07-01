import type { AccountInvitationKind } from '../../domain/access/account-invitation'

export interface InvitationDeliveryInput {
  invitationId: string
  schoolId: string
  contactChannel: 'email' | 'phone'
  contactValue: string
  displayName: string
  actorKind: AccountInvitationKind
  inviteUrl: string
  expiresAt: Date
  /** Rendered invitation email subject */
  emailSubject: string
  /** Rendered invitation email HTML body */
  emailBody: string
}

/** Delivers invite messages to pre-account contacts via the notification provider. */
export interface InvitationDeliveryPort {
  deliver: (input: InvitationDeliveryInput) => Promise<void>
  revoke: (invitationId: string) => Promise<void>
}
