import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { directPermissionEntityConfig, unique } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt } from '../utils'

export interface GuardianStudentLinkArgs {
  id: string
  schoolId: string
  guardianId: string
  studentId: string
  relationship?: string
  isPrimary?: boolean
  isBillingContact?: boolean
  legalGuardian?: boolean
  canPickup?: boolean
  emergencyContactPriority?: number | null
  receivesAcademicReports?: boolean
  receivesAttendanceAlerts?: boolean
  contactRestrictions?: string | null
  notes?: string | null
  createdAt?: Date
}

/**
 * Defines a relationship between a guardian and a student.
 * Enables multiple guardians per student and multiple students per guardian.
 */
export class GuardianStudentLink {
  readonly id: string
  readonly schoolId: string
  readonly guardianId: string
  readonly studentId: string
  readonly relationship: string
  readonly isPrimary: boolean
  readonly isBillingContact: boolean
  readonly legalGuardian: boolean
  readonly canPickup: boolean
  readonly emergencyContactPriority?: number
  readonly receivesAcademicReports: boolean
  readonly receivesAttendanceAlerts: boolean
  readonly contactRestrictions?: string
  readonly notes?: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    guardianId,
    studentId,
    relationship = 'parent',
    isPrimary = false,
    isBillingContact = false,
    legalGuardian = false,
    canPickup = false,
    emergencyContactPriority,
    receivesAcademicReports = true,
    receivesAttendanceAlerts = true,
    contactRestrictions,
    notes,
    createdAt,
  }: GuardianStudentLinkArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.guardianId = requireNonBlank(guardianId, 'guardianId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.relationship = requireNonBlank(relationship, 'relationship')
    this.isPrimary = isPrimary
    this.isBillingContact = isBillingContact
    this.legalGuardian = legalGuardian
    this.canPickup = canPickup
    if (emergencyContactPriority != null) {
      this.emergencyContactPriority = requirePositiveInt(emergencyContactPriority, 'emergencyContactPriority')
    }
    this.receivesAcademicReports = receivesAcademicReports
    this.receivesAttendanceAlerts = receivesAttendanceAlerts
    this.contactRestrictions = requireOptionalNonBlank(contactRestrictions, 'contactRestrictions')
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.createdAt = createdAt ?? new Date()
  }
}

export const guardianStudentLinkConfig: EntityConfigFactory<GuardianStudentLink> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.guardianLinks,
    Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
    Permission.PARENT_UPDATE,
    async (actor, entities) => {
      await input.policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    },
  )
  return {
    ...config,
    gates: {
      preSave: validateGuardianStudentLinkSave,
    },
  }
}

export async function validateGuardianStudentLinkSave(
  link: GuardianStudentLink,
  existing: GuardianStudentLink | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [guardian, student] = await Promise.all([
    repositories.guardians.findById(link.guardianId),
    repositories.students.findById(link.studentId),
  ])
  if (!guardian || !student || guardian.schoolId !== link.schoolId || student.schoolId !== link.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.guardianId !== link.guardianId || existing.studentId !== link.studentId)) {
    denyResourceAccess()
  }
}
