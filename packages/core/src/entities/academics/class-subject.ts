import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '../../utils/validation'

export interface ClassSubjectArgs {
  id: string
  classGroupId: string
  subjectId: string
  staffId?: string | null
  coefficient?: number | null
  completedPercentage?: number | null
  createdAt?: Date
}

/**
 * Represents a concrete subject offering inside a classGroup for an academic year.
 * This is the teachable unit used by assessments, attendance planning, and staff assignment.
 */
export class ClassSubject {
  readonly id: string
  readonly classGroupId: string
  readonly subjectId: string
  readonly staffId?: string
  readonly coefficient?: number
  readonly createdAt: Date
  readonly completedPercentage: number

  constructor({
    id,
    classGroupId,
    subjectId,
    staffId,
    coefficient,
    createdAt,
    completedPercentage,
  }: ClassSubjectArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.subjectId = requireNonBlank(subjectId, 'subjectId')
    this.staffId = requireOptionalNonBlank(staffId, 'staffId')
    if (coefficient != null) {
      this.coefficient = requirePositiveNumber(coefficient, 'coefficient')
    }
    this.createdAt = createdAt ?? new Date()
    this.completedPercentage = completedPercentage ?? 0
  }
}
