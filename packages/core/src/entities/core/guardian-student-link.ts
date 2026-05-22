import { requireNonBlank } from '$lib/core/validation'

export interface GuardianStudentLinkArgs {
  id: string
  schoolId: string
  guardianId: string
  studentId: string
  relationship?: string
  isPrimary?: boolean
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
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    guardianId,
    studentId,
    relationship = 'parent',
    isPrimary = false,
    createdAt,
  }: GuardianStudentLinkArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.guardianId = requireNonBlank(guardianId, 'guardianId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.relationship = requireNonBlank(relationship, 'relationship')
    this.isPrimary = isPrimary
    this.createdAt = createdAt ?? new Date()
  }
}
