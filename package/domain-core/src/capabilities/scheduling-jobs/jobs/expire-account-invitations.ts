import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { AccountInvitationStatus } from '../../../domain/access/account-invitation'

export async function expireAccountInvitations(context: SchoolCronJobContext): Promise<CronJobResult> {
  const { service, asOf } = context
  const invitations = await service.baseService.repositories.accountInvitations.list({
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

    await service.baseService.invitationDelivery.revoke(invitation.id)
    await service.baseService.repositories.accountInvitations.save(
      invitation.copyWith({ status: AccountInvitationStatus.Expired }),
    )
    processed += 1
  }

  return { processed, skipped }
}
