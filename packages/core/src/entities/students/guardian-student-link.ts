import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt } from '../../utils/validation'

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
