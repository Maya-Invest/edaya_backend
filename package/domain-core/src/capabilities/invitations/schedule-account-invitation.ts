import type { Guardian, StaffMember, Student } from '../domains'
import type { BaseSchoolService } from '../services/base-school-service'
import { Permission } from '../authorization'
import {
  AccountInvitationContactChannel,
  AccountInvitationKind,
} from '../domains/access/account-invitation'
import { AccountInvitationServiceWorkflow } from '../services/service-workflows/account-invitation'
import { permissionAction } from '../shared'
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
      await permissionAction(Permission.ACCESS_CONTROL_ASSIGN)(baseService.actor)
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
