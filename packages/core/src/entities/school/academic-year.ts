import { requireNonBlank, requireValidDate } from '../../utils/validation'

export interface AcademicYearArgs {
  id: string
  schoolId: string
  name: string
  startDate: Date
  endDate: Date
  isActive?: boolean
  createdAt?: Date
}

/**
 * Represents a full academic year for a school.
 * Contains multiple academic periods and defines the overall timeline.
 */
export class AcademicYear {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly startDate: Date
  readonly endDate: Date
  readonly isActive: boolean
  readonly createdAt: Date

  constructor({ id, schoolId, name, startDate, endDate, isActive = true, createdAt }: AcademicYearArgs) {
    const normalizedStartDate = requireValidDate(startDate, 'startDate')
    const normalizedEndDate = requireValidDate(endDate, 'endDate')
    if (normalizedEndDate.getTime() < normalizedStartDate.getTime()) {
      throw new Error('endDate must not be before startDate')
    }

    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.startDate = normalizedStartDate
    this.endDate = normalizedEndDate
    this.isActive = isActive
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : new Date()
  }

  contains(value: Date): boolean {
    return value.getTime() >= this.startDate.getTime() && value.getTime() <= this.endDate.getTime()
  }
}
