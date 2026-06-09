import type { ActorMetadata } from '../../authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { directPermissionEntityConfig } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export interface StaffMemberArgs {
  id: string
  schoolId: string
  firstName: string
  lastName: string
  email?: string | null
  subjectId?: string | null
  isActive?: boolean
  createdAt?: Date
}

/**
 * Represents a school staff member.
 */
export class StaffMember {
  readonly id: string
  readonly schoolId: string
  readonly firstName: string
  readonly lastName: string
  readonly email?: string
  readonly subjectId?: string
  readonly isActive: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    firstName,
    lastName,
    email,
    subjectId,
    isActive = true,
    createdAt,
  }: StaffMemberArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.firstName = requireNonBlank(firstName, 'firstName')
    this.lastName = requireNonBlank(lastName, 'lastName')
    this.email = requireOptionalNonBlank(email, 'email')
    this.subjectId = requireOptionalNonBlank(subjectId, 'subjectId')
    this.isActive = isActive
    this.createdAt = createdAt ?? new Date()
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }
}

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
  repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<void> {
  const school = await repositories.schools.findById(staffMember.schoolId)
  if (existing?.isActive && !staffMember.isActive && school?.ownerStaffId === staffMember.id) {
    throw new BusinessRuleViolationError('SCHOOL_OWNER_DEACTIVATION_BLOCKED', 'Transfer school ownership before deactivating the owner')
  }

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
  const school = await repositories.schools.findById(staffMember.schoolId)
  if (school?.ownerStaffId === staffMember.id) {
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
