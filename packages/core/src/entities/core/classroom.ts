import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt } from '$lib/core/utils/validation'

export enum AttendanceMode {
  Daily = 'daily',
  Session = 'session',
}

export interface ClassroomArgs {
  id: string
  schoolId: string
  academicYearId: string
  gradeLevelId: string
  name: string
  capacity?: number | null
  attendanceMode?: AttendanceMode
  homeroomTeacherId?: string | null
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
  readonly attendanceMode: AttendanceMode
  readonly homeroomTeacherId?: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    gradeLevelId,
    name,
    capacity,
    attendanceMode = AttendanceMode.Session,
    homeroomTeacherId,
    createdAt,
  }: ClassroomArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.gradeLevelId = requireNonBlank(gradeLevelId, 'gradeLevelId')
    this.name = requireNonBlank(name, 'name')
    if (capacity != null) {
      this.capacity = requirePositiveInt(capacity, 'capacity')
    }
    this.attendanceMode = attendanceMode
    this.homeroomTeacherId = requireOptionalNonBlank(homeroomTeacherId, 'homeroomTeacherId')
    this.createdAt = createdAt ?? new Date()
  }
}
