import type { ResolveInvitationDispatchRecipient } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { AccountInvitationContactChannel, AccountInvitationStatus } from '@edaya/core'

/** Read current credential lifecycle through school/action scope before a queued invitation is sent. */
export async function resolveInvitationDispatchRecipient(
  base: BaseSchoolService,
  request: Parameters<ResolveInvitationDispatchRecipient>[0],
): ReturnType<ResolveInvitationDispatchRecipient> {
  if (request.schoolId !== base.actor.schoolId)
    denyResourceAccess()
  const scope = await base.access.invitations.dispatchScope()
  const invitation = await base.repositories.accountInvitations.forAccess(scope).findById(request.invitationId)
  if (!invitation || invitation.status !== AccountInvitationStatus.Pending || invitation.expiresAt.getTime() <= Date.now()
    || invitation.contactChannel !== AccountInvitationContactChannel.Email) {
    return undefined
  }
  return { schoolId: invitation.schoolId, invitationId: invitation.id, email: invitation.contactValue }
}
