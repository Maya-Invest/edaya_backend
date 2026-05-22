import { requireNonBlank, requireOptionalNonBlank } from '$lib/core/validation'

export interface HealthRecordArgs {
  id: string
  studentId: string
  allergies?: string | null
  medicalConditions?: string | null
  emergencyProtocols?: string | null
  bloodType?: string | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Stores important health and medical information for a student to ensure safety and proper care.
 */
export class HealthRecord {
  readonly id: string
  readonly studentId: string
  readonly allergies?: string
  readonly medicalConditions?: string
  readonly emergencyProtocols?: string
  readonly bloodType?: string
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    studentId,
    allergies,
    medicalConditions,
    emergencyProtocols,
    bloodType,
    createdAt,
    updatedAt,
  }: HealthRecordArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.allergies = requireOptionalNonBlank(allergies, 'allergies')
    this.medicalConditions = requireOptionalNonBlank(medicalConditions, 'medicalConditions')
    this.emergencyProtocols = requireOptionalNonBlank(emergencyProtocols, 'emergencyProtocols')
    this.bloodType = requireOptionalNonBlank(bloodType, 'bloodType')

    const now = new Date()
    this.createdAt = createdAt ?? now
    this.updatedAt = updatedAt ?? now
  }
}
