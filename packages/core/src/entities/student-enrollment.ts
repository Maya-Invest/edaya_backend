import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt, requireValidDate } from '../validation'

export enum EnrollmentOutcome {
  Pending = 'pending',
  Promoted = 'promoted',
  Retained = 'retained',
  Transferred = 'transferred',
  Withdrawn = 'withdrawn',
}

export interface StudentEnrollmentArgs {
  id: string
  studentId: string
  classroomId: string
  academicYearId: string
  enrollmentIndex: number
  isCurrent?: boolean
  outcome?: EnrollmentOutcome
  previousEnrollmentId?: string | null
  outcomeDecidedAt?: Date | null
  outcomeNotes?: string | null
  createdAt?: Date
}

/**
 * Represents the enrollment of a student in a specific classroom for a given academic year.
 * Facilitates historical tracking of a student's class progression and year-end promotion decisions.
 */
export class StudentEnrollment {
  readonly id: string
  readonly studentId: string
  readonly classroomId: string
  readonly academicYearId: string
  readonly enrollmentIndex: number
  readonly isCurrent: boolean
  readonly outcome: EnrollmentOutcome
  readonly previousEnrollmentId?: string
  readonly outcomeDecidedAt?: Date
  readonly outcomeNotes?: string
  readonly createdAt: Date

  constructor({
    id,
    studentId,
    classroomId,
    academicYearId,
    enrollmentIndex,
    isCurrent = true,
    outcome = EnrollmentOutcome.Pending,
    previousEnrollmentId,
    outcomeDecidedAt,
    outcomeNotes,
    createdAt,
  }: StudentEnrollmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.classroomId = requireNonBlank(classroomId, 'classroomId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.enrollmentIndex = requirePositiveInt(enrollmentIndex, 'enrollmentIndex')
    this.isCurrent = isCurrent
    this.outcome = outcome
    this.previousEnrollmentId = requireOptionalNonBlank(previousEnrollmentId, 'previousEnrollmentId')
    this.outcomeDecidedAt = outcomeDecidedAt ? requireValidDate(outcomeDecidedAt, 'outcomeDecidedAt') : undefined
    this.outcomeNotes = requireOptionalNonBlank(outcomeNotes, 'outcomeNotes')
    this.createdAt = createdAt ?? new Date()

    if (this.outcome !== EnrollmentOutcome.Pending && !this.outcomeDecidedAt) {
      throw new Error('outcomeDecidedAt is required when outcome is not pending')
    }
    if (this.outcome === EnrollmentOutcome.Pending && this.outcomeDecidedAt) {
      throw new Error('pending enrollments must not define outcomeDecidedAt')
    }
  }
}
