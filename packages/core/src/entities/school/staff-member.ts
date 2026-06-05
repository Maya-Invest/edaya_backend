import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export enum StaffRole {
  Admin = 'admin',
  Principal = 'principal',
  Teacher = 'teacher',
  Accountant = 'accountant',
  Counselor = 'counselor',
  Coordinator = 'coordinator',
  Supervisor = 'supervisor',
}

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
