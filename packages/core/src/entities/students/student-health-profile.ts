import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export interface StudentHealthProfileArgs {
  id: string
  schoolId: string
  studentId: string
  allergies?: string | null
  medicalConditions?: string | null
  emergencyProtocols?: string | null
  bloodType?: string | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Contains health and emergency information that requires access controls
 * independent from the general student directory profile.
 */
export class StudentHealthProfile {
  readonly id: string
  readonly schoolId: string
  readonly studentId: string
  readonly allergies?: string
  readonly medicalConditions?: string
  readonly emergencyProtocols?: string
  readonly bloodType?: string
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    studentId,
    allergies,
    medicalConditions,
    emergencyProtocols,
    bloodType,
    createdAt,
    updatedAt,
  }: StudentHealthProfileArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.allergies = requireOptionalNonBlank(allergies, 'allergies')
    this.medicalConditions = requireOptionalNonBlank(medicalConditions, 'medicalConditions')
    this.emergencyProtocols = requireOptionalNonBlank(emergencyProtocols, 'emergencyProtocols')
    this.bloodType = requireOptionalNonBlank(bloodType, 'bloodType')
    const now = new Date()
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : now
    if (this.updatedAt.getTime() < this.createdAt.getTime()) {
      throw new Error('updatedAt must not be before createdAt')
    }
  }
}
