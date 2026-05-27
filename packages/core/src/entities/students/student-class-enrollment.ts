import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt, requireValidDate } from '../utils'

export enum StudentClassEnrollmentStatus {
  Active = 'active',
  Closed = 'closed',
}

export enum EnrollmentEndReason {
  Completed = 'completed',
  Transferred = 'transferred',
  Withdrawn = 'withdrawn',
}

export enum ProgressionDecision {
  Promoted = 'promoted',
  Retained = 'retained',
  Graduated = 'graduated',
}

export interface StudentClassEnrollmentArgs {
  id: string
  studentId: string
  classGroupId: string
  academicYearId: string
  enrollmentIndex: number
  status?: StudentClassEnrollmentStatus
  enrolledAt?: Date
  endedAt?: Date | null
  endReason?: EnrollmentEndReason | null
  progressionDecision?: ProgressionDecision | null
  previousEnrollmentId?: string | null
  closedBy?: string | null
  progressionDecidedAt?: Date | null
  progressionDecidedBy?: string | null
  progressionNotes?: string | null
  createdAt?: Date
}

/**
 * Records one placement in a class. Closing a placement and deciding the
 * student's next progression are separate facts.
 */
export class StudentClassEnrollment {
  readonly id: string
  readonly studentId: string
  readonly classGroupId: string
  readonly academicYearId: string
  readonly enrollmentIndex: number
  readonly status: StudentClassEnrollmentStatus
  readonly enrolledAt: Date
  readonly endedAt?: Date
  readonly endReason?: EnrollmentEndReason
  readonly progressionDecision?: ProgressionDecision
  readonly previousEnrollmentId?: string
  readonly closedBy?: string
  readonly progressionDecidedAt?: Date
  readonly progressionDecidedBy?: string
  readonly progressionNotes?: string
  readonly createdAt: Date

  constructor({
    id,
    studentId,
    classGroupId,
    academicYearId,
    enrollmentIndex,
    status = StudentClassEnrollmentStatus.Active,
    enrolledAt,
    endedAt,
    endReason,
    progressionDecision,
    previousEnrollmentId,
    closedBy,
    progressionDecidedAt,
    progressionDecidedBy,
    progressionNotes,
    createdAt,
  }: StudentClassEnrollmentArgs) {
    const now = new Date()
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.enrollmentIndex = requirePositiveInt(enrollmentIndex, 'enrollmentIndex')
    this.status = status
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.enrolledAt = enrolledAt ? requireValidDate(enrolledAt, 'enrolledAt') : this.createdAt
    this.endedAt = endedAt ? requireValidDate(endedAt, 'endedAt') : undefined
    this.endReason = endReason ?? undefined
    this.progressionDecision = progressionDecision ?? undefined
    this.previousEnrollmentId = requireOptionalNonBlank(previousEnrollmentId, 'previousEnrollmentId')
    this.closedBy = requireOptionalNonBlank(closedBy, 'closedBy')
    this.progressionDecidedAt = progressionDecidedAt
      ? requireValidDate(progressionDecidedAt, 'progressionDecidedAt')
      : undefined
    this.progressionDecidedBy = requireOptionalNonBlank(progressionDecidedBy, 'progressionDecidedBy')
    this.progressionNotes = requireOptionalNonBlank(progressionNotes, 'progressionNotes')

    if (this.status === StudentClassEnrollmentStatus.Active && (this.endedAt || this.endReason || this.closedBy)) {
      throw new Error('active enrollments must not define closure information')
    }
    if (this.status === StudentClassEnrollmentStatus.Closed && (!this.endedAt || !this.endReason || !this.closedBy)) {
      throw new Error('closed enrollments must define endedAt, endReason, and closedBy')
    }
    if (this.endedAt && this.endedAt.getTime() < this.enrolledAt.getTime()) {
      throw new Error('endedAt must not be before enrolledAt')
    }
    if (this.progressionDecision && (!this.progressionDecidedAt || !this.progressionDecidedBy)) {
      throw new Error('progressionDecidedAt and progressionDecidedBy are required when a progression decision is recorded')
    }
    if (!this.progressionDecision && (this.progressionDecidedAt || this.progressionDecidedBy || this.progressionNotes)) {
      throw new Error('progression metadata requires a progression decision')
    }
    if (this.progressionDecision && this.endReason !== EnrollmentEndReason.Completed) {
      throw new Error('a progression decision requires a completed enrollment')
    }
  }

  close({
    endedAt,
    endReason,
    closedBy,
  }: {
    endedAt: Date
    endReason: EnrollmentEndReason
    closedBy: string
  }): StudentClassEnrollment {
    if (this.status !== StudentClassEnrollmentStatus.Active) {
      throw new Error(`Enrollment ${this.id} is already closed`)
    }
    return new StudentClassEnrollment({
      id: this.id,
      studentId: this.studentId,
      classGroupId: this.classGroupId,
      academicYearId: this.academicYearId,
      enrollmentIndex: this.enrollmentIndex,
      status: StudentClassEnrollmentStatus.Closed,
      enrolledAt: this.enrolledAt,
      endedAt,
      endReason,
      previousEnrollmentId: this.previousEnrollmentId,
      closedBy,
      createdAt: this.createdAt,
    })
  }

  recordProgressionDecision({
    decision,
    decidedAt,
    decidedBy,
    notes,
  }: {
    decision: ProgressionDecision
    decidedAt: Date
    decidedBy: string
    notes?: string
  }): StudentClassEnrollment {
    if (this.progressionDecision) {
      throw new Error(`Enrollment ${this.id} already has a progression decision`)
    }
    return new StudentClassEnrollment({
      id: this.id,
      studentId: this.studentId,
      classGroupId: this.classGroupId,
      academicYearId: this.academicYearId,
      enrollmentIndex: this.enrollmentIndex,
      status: this.status,
      enrolledAt: this.enrolledAt,
      endedAt: this.endedAt,
      endReason: this.endReason,
      previousEnrollmentId: this.previousEnrollmentId,
      closedBy: this.closedBy,
      progressionDecision: decision,
      progressionDecidedAt: decidedAt,
      progressionDecidedBy: decidedBy,
      progressionNotes: notes,
      createdAt: this.createdAt,
    })
  }
}
