import type { StaffMember } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'

import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'
import { assertUniqueHumanIdentifier } from '../human-identifier-uniqueness'

// Extracted from domain/school/staff-member.ts (PR3)
export const staffMemberConfig: EntityConfigFactory<StaffMember> = (input) => {
  return {
    ...config({
      repository: input.repositories.staffMembers,
      tenant: directSchoolTenant<StaffMember>(),
      resource: 'staffMembers',

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
): Promise<void> {
  const school = await repositories.schools.findById(staffMember.schoolId)
  const ownerSubjectId = school?.ownerSubjectId
  const subjectId = staffMember.subjectId ?? existing?.subjectId
  if (existing?.isActive && !staffMember.isActive && ownerSubjectId && subjectId === ownerSubjectId) {
    throw new BusinessRuleViolationError('SCHOOL_OWNER_DEACTIVATION_BLOCKED', 'Transfer school ownership before deactivating the owner')
  }

  await assertUniqueHumanIdentifier({
    identifier: staffMember.identifier,
    schoolId: staffMember.schoolId,
    entityId: staffMember.id,
    errorCode: 'IDENTIFIER_UNAVAILABLE',
    entityLabel: 'Staff member',
    findCandidates: identifier => repositories.staffMembers.list({ schoolId: staffMember.schoolId, identifier: { $normalizedCandidate: identifier } }),
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
