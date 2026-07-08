import type { Guardian, StaffMember, Student } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { AccessControlOperations } from '@edaya/authorization'
import {
  AccountInvitationContactChannel,
  AccountInvitationKind,
} from '@edaya/core'
import { operationModule } from '../../services/entities/entity-config'
import { AccountInvitationServiceWorkflow } from '../../services/workflows/account-invitation'
import { resolveStudentInvitationEmail } from './resolve-invitation-contact'

export interface ScheduleAccountInvitationInput {
  kind: AccountInvitationKind
  targetId: string
  sendAccountInvitation?: boolean
  inviteEmail?: string
}

export function scheduleAccountInvitationIfEligible(
  baseService: BaseSchoolService,
  input: ScheduleAccountInvitationInput,
  entity: StaffMember | Guardian | Student,
): void {
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

  void (async () => {
    try {
      await operationModule(AccessControlOperations.assign)(baseService.actor)
      const workflow = new AccountInvitationServiceWorkflow(baseService)
      await workflow.sendAccountInvitation({
        kind: input.kind,
        targetId: input.targetId,
        contactChannel: AccountInvitationContactChannel.Email,
        contactValue: input.kind === AccountInvitationKind.Student
          ? resolveStudentInvitationEmail(input.inviteEmail)
          : undefined,
        inviteBaseUrl: baseService.inviteBaseUrl!,
      })
    }
    catch {
      // Invitation delivery must not break entity registration.
    }
  })()
}
