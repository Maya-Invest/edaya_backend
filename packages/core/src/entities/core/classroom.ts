import { requireNonBlank, requirePositiveInt } from '$lib/core/validation'

export interface ClassroomArgs {
  id: string
  schoolId: string
  academicYearId: string
  gradeLevelId: string
  name: string
  capacity?: number | null
  createdAt?: Date
}

/**
 * Represents a physical or logical classroom where students are enrolled.
 * Examples include "Grade 10A" or "Form 4 Science".
 * References a GradeLevel for structured level tracking.
 */
export class Classroom {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly gradeLevelId: string
  readonly name: string
  readonly capacity?: number
  readonly createdAt: Date

  constructor({ id, schoolId, academicYearId, gradeLevelId, name, capacity, createdAt }: ClassroomArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.gradeLevelId = requireNonBlank(gradeLevelId, 'gradeLevelId')
    this.name = requireNonBlank(name, 'name')
    if (capacity != null) {
      this.capacity = requirePositiveInt(capacity, 'capacity')
    }
    this.createdAt = createdAt ?? new Date()
  }
}
