import { requireNonBlank, requireValidDate } from '../utils'

export enum AcademicPeriodType {
  Trimester = 'trimester',
  Semester = 'semester',
  Other = 'other',
}

export interface AcademicPeriodArgs {
  id: string
  schoolId: string
  academicYearId: string
  name: string
  type: AcademicPeriodType
  startDate: Date
  endDate: Date
  isPublished?: boolean
  createdAt?: Date
}

/**
 * Represents a specific time period within an academic year (e.g., Trimester, Semester).
 * Used for organizing grading, attendance, and reporting.
 */
export class AcademicPeriod {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly name: string
  readonly type: AcademicPeriodType
  readonly startDate: Date
  readonly endDate: Date
  readonly isPublished: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    name,
    type,
    startDate,
    endDate,
    isPublished = false,
    createdAt,
  }: AcademicPeriodArgs) {
    const normalizedStartDate = requireValidDate(startDate, 'startDate')
    const normalizedEndDate = requireValidDate(endDate, 'endDate')
    if (normalizedEndDate.getTime() < normalizedStartDate.getTime()) {
      throw new Error('endDate must not be before startDate')
    }

    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.name = requireNonBlank(name, 'name')
    this.type = type
    this.startDate = normalizedStartDate
    this.endDate = normalizedEndDate
    this.isPublished = isPublished
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : new Date()
  }

  contains(value: Date): boolean {
    return value.getTime() >= this.startDate.getTime() && value.getTime() <= this.endDate.getTime()
  }
}
