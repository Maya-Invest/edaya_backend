import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt } from '$lib/core/utils/validation'

export enum AttendanceMode {
  Daily = 'daily',
  Session = 'session',
}

export interface ClassGroupArgs {
  id: string
  schoolId: string
  academicYearId: string
  gradeLevelId: string
  name: string
  capacity?: number | null
  attendanceMode?: AttendanceMode
  homeroomStaffId?: string | null
  createdAt?: Date
}

/**
 * Represents an academic class group where students are enrolled.
 * Examples include "Grade 10A" or "Form 4 Science".
 * References a GradeLevel for structured level tracking.
 */
export class ClassGroup {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly gradeLevelId: string
  readonly name: string
  readonly capacity?: number
  readonly attendanceMode: AttendanceMode
  readonly homeroomStaffId?: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    gradeLevelId,
    name,
    capacity,
    attendanceMode = AttendanceMode.Session,
    homeroomStaffId,
    createdAt,
  }: ClassGroupArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.gradeLevelId = requireNonBlank(gradeLevelId, 'gradeLevelId')
    this.name = requireNonBlank(name, 'name')
    if (capacity != null) {
      this.capacity = requirePositiveInt(capacity, 'capacity')
    }
    this.attendanceMode = attendanceMode
    this.homeroomStaffId = requireOptionalNonBlank(homeroomStaffId, 'homeroomStaffId')
    this.createdAt = createdAt ?? new Date()
  }
}
