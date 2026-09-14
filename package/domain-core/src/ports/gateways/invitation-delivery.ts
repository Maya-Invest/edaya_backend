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
  emailSubject?: string
  emailBody?: string
  smsBody?: string
}

export type ResolveInvitationDispatchRecipient = (request: { schoolId: string, invitationId: string }) => Promise<{
  schoolId: string
  invitationId: string
  contactChannel: 'email' | 'phone'
  contactValue: string
} | undefined>

/** Persist invitation delivery intent with the business transaction; provider I/O occurs after commit. */
export interface InvitationDeliveryPort {
  deliver: (input: InvitationDeliveryInput) => Promise<void>
  revoke: (invitationId: string, schoolId: string) => Promise<void>
}
