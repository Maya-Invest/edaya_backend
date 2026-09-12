import { Permission } from '@edaya/core';
import type { ActorMetadata } from '@edaya/authorization';
import type { StaffMember } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';

import { BusinessRuleViolationError } from '@edaya/core';
import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';
import { assertUniquePersonCode } from '../person-code-uniqueness';

// Extracted from domain/school/staff-member.ts (PR3)
export const staffMemberConfig: EntityConfigFactory<StaffMember> = (input) => {
  

  return {
    ...config({
      repository: input.repositories.staffMembers,
      tenant: directSchoolTenant<StaffMember>(),
      authorization: { resource: 'staffMembers', read: [Permission.QUERY_WORKSPACE_READ, Permission.SCHOOL_STRUCTURE_CONFIGURE, Permission.STAFF_READ], write: [Permission.SCHOOL_STRUCTURE_CONFIGURE] },
      
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
