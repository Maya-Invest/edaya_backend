import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum StudentStatus {
  Active = 'active',
  Inactive = 'inactive',
  Graduated = 'graduated',
  Archived = 'archived',
}

export interface StudentArgs {
  id: string
  schoolId: string
  firstName: string
  lastName: string
  gender?: string | null
  birthDate?: Date
  placeOfBirth?: string | null
  nationality?: string | null
  matricule?: string | null
  photoUrl?: string | null
  status?: StudentStatus
  enrollmentDate?: Date | null
  createdAt?: Date
}

/**
 * Represents an individual student attending the school.
 * Holds fundamental biographical data.
 * Gender is a free-form string to allow school-specific customisation.
 */
export class Student {
  readonly id: string
  readonly schoolId: string
  readonly firstName: string
  readonly lastName: string
  readonly gender?: string
  readonly birthDate?: Date
  readonly placeOfBirth?: string
  readonly nationality?: string
  readonly matricule?: string
  readonly photoUrl?: string
  readonly status: StudentStatus
  readonly enrollmentDate?: Date
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    firstName,
    lastName,
    gender,
    birthDate,
    placeOfBirth,
    nationality,
    matricule,
    photoUrl,
    status = StudentStatus.Active,
    enrollmentDate,
    createdAt,
  }: StudentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.firstName = requireNonBlank(firstName, 'firstName')
    this.lastName = requireNonBlank(lastName, 'lastName')
    this.gender = requireOptionalNonBlank(gender, 'gender')
    this.birthDate = birthDate
    this.placeOfBirth = requireOptionalNonBlank(placeOfBirth, 'placeOfBirth')
    this.nationality = requireOptionalNonBlank(nationality, 'nationality')
    this.matricule = requireOptionalNonBlank(matricule, 'matricule')
    this.photoUrl = requireOptionalNonBlank(photoUrl, 'photoUrl')
    this.status = status
    this.enrollmentDate = enrollmentDate ? requireValidDate(enrollmentDate, 'enrollmentDate') : undefined
    this.createdAt = createdAt ?? new Date()
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  copyWith(changes: Partial<StudentArgs>): Student {
    return new Student({
      id: this.id,
      schoolId: this.schoolId,
      firstName: this.firstName,
      lastName: this.lastName,
      gender: this.gender,
      birthDate: this.birthDate,
      placeOfBirth: this.placeOfBirth,
      nationality: this.nationality,
      matricule: this.matricule,
      photoUrl: this.photoUrl,
      status: this.status,
      enrollmentDate: this.enrollmentDate,
      createdAt: this.createdAt,
      ...changes,
    })
  }
}
