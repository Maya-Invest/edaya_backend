import { requireNonBlank, requireValidDate } from '$lib/core/utils/validation'

export enum ActivityRole {
  Member = 'member',
  Leader = 'leader',
  Captain = 'captain',
}

export interface StudentActivityEnrollmentArgs {
  id: string
  activityId: string
  studentId: string
  role?: ActivityRole
  joinedAt?: Date
  leftAt?: Date | null
  createdAt?: Date
}

/**
 * Represents a student's membership or participation in an extracurricular Activity.
 */
export class StudentActivityEnrollment {
  readonly id: string
  readonly activityId: string
  readonly studentId: string
  readonly role: ActivityRole
  readonly joinedAt: Date
  readonly leftAt?: Date
  readonly createdAt: Date

  constructor({
    id,
    activityId,
    studentId,
    role = ActivityRole.Member,
    joinedAt,
    leftAt,
    createdAt,
  }: StudentActivityEnrollmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.activityId = requireNonBlank(activityId, 'activityId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.role = role

    const now = new Date()
    this.joinedAt = joinedAt ?? now
    if (leftAt != null) {
      this.leftAt = requireValidDate(leftAt, 'leftAt')
      if (this.leftAt.getTime() < this.joinedAt.getTime()) {
        throw new Error('leftAt cannot be before joinedAt')
      }
    }

    this.createdAt = createdAt ?? now
  }
}
