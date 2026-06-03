import type { ActorMetadata } from '../../../authorization'
import type { StaffMember } from '../../../entities/school/staff-member'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared/common'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { directEntityConfig } from '../../../shared/common'

export const staffMemberConfig: EntityConfigFactory<StaffMember> = (input) => {
  const config = directEntityConfig(input, input.repositories.staffMembers, 'setup.manage', 'setup.manage')
  return {
    ...config,
    gates: {
      preSave: validateStaffMemberSave,
    },
  }
}

export async function validateStaffMemberSave(
  staffMember: StaffMember,
  existing: StaffMember | undefined,
  _repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<void> {
  if (
    existing?.isActive
    && !staffMember.isActive
    && actor.kind === 'staff'
    && staffMember.id === actor.staffMemberId
  ) {
    throw new BusinessRuleViolationError('SELF_DEACTIVATION_BLOCKED', 'Staff members cannot deactivate their own account')
  }
}
