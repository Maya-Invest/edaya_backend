import type { ActorMetadata } from '../../../authorization'
import type { StaffMember } from '../../../entities/school/staff-member'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const staffMemberConfig: EntityConfigFactory<StaffMember> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.staffMembers,
    Permission.SCHOOL_STRUCTURE_CONFIGURE,
    Permission.SCHOOL_STRUCTURE_CONFIGURE,
  )
  return {
    ...config,
    gates: {
      preSave: validateStaffMemberSave,
      preDelete: validateStaffMemberDelete,
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

async function validateStaffMemberDelete(
  staffMember: StaffMember,
  repositories: SchoolRepositories,
): Promise<void> {
  const [assignments, homeroomClasses, reportedIncidents, assignedActions, authoredNotes] = await Promise.all([
    repositories.staffAssignments.list({ staffId: staffMember.id }),
    repositories.classGroups.list({ homeroomStaffId: staffMember.id }),
    repositories.incidents.list({ reporterId: staffMember.id }),
    repositories.studentDisciplinaryActions.list({ assignedByStaffId: staffMember.id }),
    repositories.studentNotes.list({ authorStaffId: staffMember.id }),
  ])
  if (
    assignments.length > 0
    || homeroomClasses.length > 0
    || reportedIncidents.length > 0
    || assignedActions.length > 0
    || authoredNotes.length > 0
  ) {
    throw new BusinessRuleViolationError('STAFF_MEMBER_HAS_DEPENDENCIES', `Cannot delete staff member ${staffMember.id}: dependent records still exist`)
  }
}
