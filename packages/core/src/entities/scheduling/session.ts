import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum SessionKind {
  Course = 'course',
  Evaluation = 'evaluation',
  Event = 'event',
  Other = 'other',
}

export interface SessionArgs {
  id: string
  classGroupId: string
  title: string
  kind: SessionKind
  startsAt: Date
  endsAt: Date
  classSubjectId?: string | null
  scheduleId?: string | null
  createdAt?: Date
}

/**
 * Represents a concrete scheduled time slot where a classGroup activity actually happens.
 * Attendance is recorded against sessions.
 */
export class Session {
  readonly id: string
  readonly classGroupId: string
  readonly title: string
  readonly kind: SessionKind
  readonly startsAt: Date
  readonly endsAt: Date
  readonly classSubjectId?: string
  readonly scheduleId?: string
  readonly createdAt: Date

  constructor({
    id,
    classGroupId,
    title,
    kind,
    startsAt,
    endsAt,
    classSubjectId,
    scheduleId,
    createdAt,
  }: SessionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.title = requireNonBlank(title, 'title')
    this.kind = kind
    this.startsAt = requireValidDate(startsAt, 'startsAt')
    this.endsAt = requireValidDate(endsAt, 'endsAt')
    this.classSubjectId = requireOptionalNonBlank(classSubjectId, 'classSubjectId')
    this.scheduleId = requireOptionalNonBlank(scheduleId, 'scheduleId')
    this.createdAt = createdAt ?? new Date()

    if (this.endsAt.getTime() <= this.startsAt.getTime()) {
      throw new Error('endsAt must be after startsAt')
    }
  }

  get durationMinutes(): number {
    return Math.round((this.endsAt.getTime() - this.startsAt.getTime()) / 60000)
  }
}
