import { requireNonBlank, requireOptionalNonBlank } from '../../utils/validation'

export interface TeacherArgs {
  id: string
  schoolId: string
  staffMemberId: string // Reference to the base staff member
  firstName: string
  lastName: string
  email?: string | null
  matricule?: string | null // Registration ID
  specialties?: readonly string[]
  isActive?: boolean
  createdAt?: Date
}

export class Teacher {
  readonly id: string
  readonly schoolId: string
  readonly staffMemberId: string
  readonly firstName: string
  readonly lastName: string
  readonly email?: string
  readonly matricule?: string
  readonly specialties: readonly string[]
  readonly isActive: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    staffMemberId,
    firstName,
    lastName,
    email,
    matricule,
    specialties = [],
    isActive = true,
    createdAt,
  }: TeacherArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.staffMemberId = requireNonBlank(staffMemberId, 'staffMemberId')
    this.firstName = requireNonBlank(firstName, 'firstName')
    this.lastName = requireNonBlank(lastName, 'lastName')
    this.email = requireOptionalNonBlank(email, 'email')
    this.matricule = requireOptionalNonBlank(matricule, 'matricule')
    this.specialties = Object.freeze([...specialties])
    this.isActive = isActive
    this.createdAt = createdAt ?? new Date()
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }
}
