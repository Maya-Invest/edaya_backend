import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt } from '$lib/core/utils/validation'

export interface GradeLevelArgs {
  id: string
  schoolId: string
  name: string
  order: number
  cycle?: string | null
  createdAt?: Date
}

/**
 * Represents a formal grade level in the school's progression ladder
 * (e.g., CP1, CE1, Grade 10). ClassGroups reference a GradeLevel
 * to provide structured level tracking and promotion logic.
 */
export class GradeLevel {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly order: number
  readonly cycle?: string
  readonly createdAt: Date

  constructor({ id, schoolId, name, order, cycle, createdAt }: GradeLevelArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.order = requirePositiveInt(order, 'order')
    this.cycle = requireOptionalNonBlank(cycle, 'cycle')
    this.createdAt = createdAt ?? new Date()
  }
}
