import accountInvitationBody from './emails/account-invitation.txt'
import accountInvitationSubject from './subjects/account-invitation.txt'

/** Account invitation copy — single source of truth on disk for the platform default slice. */
export async function loadAccountInvitationDefaultFiles(): Promise<{
  subject: string
  body: string
}> {
  return {
    subject: accountInvitationSubject.trim(),
    body: accountInvitationBody.trim(),
  }
}
