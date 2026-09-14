import type { Guardian, StaffMember, Student } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { AuthorizationError } from '@edaya/authorization'
import { AccountInvitationContactChannel, AccountInvitationKind } from '@edaya/core'

import { AccountInvitationServiceWorkflow } from '../../services/workflows/account-invitation'
import { resolveGuardianInvitationEmail, resolveStaffInvitationEmail, resolveStudentInvitationEmail } from './resolve-invitation-contact'

export interface ScheduleAccountInvitationInput {
  kind: AccountInvitationKind
  targetId: string
  sendAccountInvitation?: boolean
  inviteEmail?: string
}

export async function scheduleAccountInvitationIfEligible(
  baseService: BaseSchoolService,
  input: ScheduleAccountInvitationInput,
  entity: StaffMember | Guardian | Student,
): Promise<void> {
  if (input.sendAccountInvitation === false) {
    return
  }
  if (baseService.accountInvitationsEnabled === false) {
    return
  }
  if (!baseService.inviteBaseUrl) {
    return
  }
  if (entity.subjectId) {
    return
  }

  const contactValue = input.kind === AccountInvitationKind.Student
    ? resolveStudentInvitationEmail(input.inviteEmail)
    : input.kind === AccountInvitationKind.Guardian
      ? resolveGuardianInvitationEmail(entity as Guardian)
      : resolveStaffInvitationEmail(entity as StaffMember)
  if (!contactValue)
    return
  try {
    await baseService.access.staffPermissions.assertAssign()
  }
  catch (error) {
    // A caller without invitation authority may still register an entity.
    // Once admitted, persistence failures must roll back the registration too.
    if (error instanceof AuthorizationError)
      return
    throw error
  }
  const workflow = new AccountInvitationServiceWorkflow(baseService)
  await workflow.sendAccountInvitation({
    kind: input.kind,
    targetId: input.targetId,
    contactChannel: AccountInvitationContactChannel.Email,
    contactValue,
    inviteBaseUrl: baseService.inviteBaseUrl,
  })
}
