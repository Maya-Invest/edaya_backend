import { requireNonBlank, requireOptionalNonBlank } from '../../validation'

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
  roles: readonly StaffRole[]
  email?: string | null
  isActive?: boolean
  createdAt?: Date
}

/**
 * Represents a school staff member with one or more roles.
 * This generalizes the current split between user accounts and teacher records.
 */
export class StaffMember {
  readonly id: string
  readonly schoolId: string
  readonly firstName: string
  readonly lastName: string
  readonly roles: readonly StaffRole[]
  readonly email?: string
  readonly isActive: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    firstName,
    lastName,
    roles,
    email,
    isActive = true,
    createdAt,
  }: StaffMemberArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.firstName = requireNonBlank(firstName, 'firstName')
    this.lastName = requireNonBlank(lastName, 'lastName')
    const uniqueRoles = [...new Set(roles)]
    if (uniqueRoles.length === 0) {
      throw new Error('roles must contain at least one role')
    }
    this.roles = Object.freeze(uniqueRoles)
    this.email = requireOptionalNonBlank(email, 'email')
    this.isActive = isActive
    this.createdAt = createdAt ?? new Date()
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  hasRole(role: StaffRole): boolean {
    return this.roles.includes(role)
  }
}
