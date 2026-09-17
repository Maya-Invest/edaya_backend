import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { AccountInvitationStatus } from '@edaya/core'
import { invitationLifecycleLockKey } from '../../invitations/invitation-lifecycle'

export async function expireAccountInvitations(context: SchoolCronJobContext): Promise<CronJobResult> {
  const { service, asOf } = context
  const invitations = await service.baseService.entities.accountInvitations.list({
    schoolId: context.actor.schoolId,
    status: AccountInvitationStatus.Pending,
  })

  let processed = 0
  let skipped = 0

  for (const invitation of invitations) {
    if (invitation.expiresAt > asOf) {
      skipped += 1
      continue
    }

    const expired = await service.baseService.atomicExecution.execute(async () => {
      const current = await service.baseService.entities.accountInvitations.findById(invitation.id)
      if (!current || current.status !== AccountInvitationStatus.Pending || current.expiresAt > asOf)
        return false
      const expired = current.copyWith({ status: AccountInvitationStatus.Expired })
      const scope = await service.baseService.access.invitations.assertSave(expired, current)
      const store = service.baseService.repositories.accountInvitations.forAccess(scope)
      const updated = await (store as typeof service.baseService.repositories.accountInvitations)
        .compareAndSetStatus(current.id, AccountInvitationStatus.Pending, expired)
      if (!updated)
        return false
      await service.baseService.invitationDelivery.revoke(current.id, current.schoolId)
      return true
    }, { lockKeys: [invitationLifecycleLockKey(invitation.schoolId, invitation.kind, invitation.targetId)] })
    if (expired)
      processed += 1
    else
      skipped += 1
  }

  return { processed, skipped }
}
