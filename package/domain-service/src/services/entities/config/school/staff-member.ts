import type { ActorMetadata } from '@edaya/authorization'
import type { StaffMember } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { SchoolStructureOperations } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'
import { assertUniquePersonCode } from '../person-code-uniqueness'

// Extracted from domain/school/staff-member.ts (PR3)
export const staffMemberConfig: EntityConfigFactory<StaffMember> = (input) => {
  const readAccess = (actor: ActorMetadata, entities: readonly StaffMember[]) =>
    input.policy.checkStaffMemberReadAccess(actor, entities)

  return {
    ...config({
      repository: input.repositories.staffMembers,
      tenant: directSchoolTenant<StaffMember>(),
      read: read(operationModule(SchoolStructureOperations.staffRead), readAccess),
      write: write(
        operationModule(SchoolStructureOperations.configure),
        authorizeExistingById(readAccess),
        authorizeDeleteByReadAccess(readAccess),
      ),
      atomicExecution: input.atomicExecution,
    }),
    gates: {
      preSave: validateStaffMemberSave,
      preDelete: validateStaffMemberDelete,
    },
  }
}

export async function validateStaffMemberSave(
  staffMember: StaffMember,
  existing: StaffMember | undefined,
  repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<void> {
  const school = await repositories.schools.findById(staffMember.schoolId)
  const ownerSubjectId = school?.ownerSubjectId
  const subjectId = staffMember.subjectId ?? existing?.subjectId
  if (existing?.isActive && !staffMember.isActive && ownerSubjectId && subjectId === ownerSubjectId) {
    throw new BusinessRuleViolationError('SCHOOL_OWNER_DEACTIVATION_BLOCKED', 'Transfer school ownership before deactivating the owner')
  }

  if (
    existing?.isActive
    && !staffMember.isActive
    && 'staffMemberId' in actor
    && actor.staffMemberId === staffMember.id
  ) {
    throw new BusinessRuleViolationError('SELF_DEACTIVATION_BLOCKED', 'Staff members cannot deactivate their own account')
  }

  await assertUniquePersonCode({
    code: staffMember.code,
    schoolId: staffMember.schoolId,
    entityId: staffMember.id,
    errorCode: 'STAFF_MEMBER_CODE_ALREADY_EXISTS',
    entityLabel: 'Staff member',
    listBySchool: () => repositories.staffMembers.list({ schoolId: staffMember.schoolId }),
  })
}

async function validateStaffMemberDelete(
  staffMember: StaffMember,
  repositories: SchoolRepositories,
): Promise<void> {
  const school = await repositories.schools.findById(staffMember.schoolId)
  if (school?.ownerSubjectId && staffMember.subjectId === school.ownerSubjectId) {
    throw new BusinessRuleViolationError('SCHOOL_OWNER_DELETE_BLOCKED', 'Transfer school ownership before deleting the owner')
  }

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
