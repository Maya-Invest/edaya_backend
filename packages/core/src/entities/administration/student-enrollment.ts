import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt, requireValidDate } from '../../utils/validation'

export enum EnrollmentOutcome {
  Pending = 'pending',
  Promoted = 'promoted',
  Retained = 'retained',
  Transferred = 'transferred',
  Withdrawn = 'withdrawn',
  Completed = 'completed',
}

export enum StudentEnrollmentStatus {
  Enrolled = 'enrolled',
  Completed = 'completed',
  Promoted = 'promoted',
  Retained = 'retained',
  Transferred = 'transferred',
  Withdrawn = 'withdrawn',
}

export interface StudentEnrollmentArgs {
  id: string
  studentId: string
  classGroupId: string
  academicYearId: string
  enrollmentIndex: number
  status?: StudentEnrollmentStatus
  enrolledAt?: Date | null
  leftAt?: Date | null
  exitReason?: string | null
  isCurrent?: boolean
  outcome?: EnrollmentOutcome
  previousEnrollmentId?: string | null
  outcomeDecidedAt?: Date | null
  outcomeNotes?: string | null
  createdAt?: Date
}

/**
 * Represents the enrollment of a student in a specific classGroup for a given academic year.
 * Facilitates historical tracking of a student's class progression and year-end promotion decisions.
 */
export class StudentEnrollment {
  readonly id: string
  readonly studentId: string
  readonly classGroupId: string
  readonly academicYearId: string
  readonly enrollmentIndex: number
  readonly status: StudentEnrollmentStatus
  readonly enrolledAt?: Date
  readonly leftAt?: Date
  readonly exitReason?: string
  readonly isCurrent: boolean
  readonly outcome: EnrollmentOutcome
  readonly previousEnrollmentId?: string
  readonly outcomeDecidedAt?: Date
  readonly outcomeNotes?: string
  readonly createdAt: Date

  constructor({
    id,
    studentId,
    classGroupId,
    academicYearId,
    enrollmentIndex,
    status = StudentEnrollmentStatus.Enrolled,
    enrolledAt,
    leftAt,
    exitReason,
    isCurrent = status === StudentEnrollmentStatus.Enrolled,
    outcome = EnrollmentOutcome.Pending,
    previousEnrollmentId,
    outcomeDecidedAt,
    outcomeNotes,
    createdAt,
  }: StudentEnrollmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.enrollmentIndex = requirePositiveInt(enrollmentIndex, 'enrollmentIndex')
    this.status = status
    this.enrolledAt = enrolledAt ? requireValidDate(enrolledAt, 'enrolledAt') : undefined
    this.leftAt = leftAt ? requireValidDate(leftAt, 'leftAt') : undefined
    this.exitReason = requireOptionalNonBlank(exitReason, 'exitReason')
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
    if (this.leftAt && this.enrolledAt && this.leftAt.getTime() < this.enrolledAt.getTime()) {
      throw new Error('leftAt must not be before enrolledAt')
    }
    if (this.status !== StudentEnrollmentStatus.Enrolled && !this.leftAt) {
      throw new Error('leftAt is required when enrollment is no longer enrolled')
    }
    if (this.status === StudentEnrollmentStatus.Enrolled && this.leftAt) {
      throw new Error('active enrollments must not define leftAt')
    }
  }
}
