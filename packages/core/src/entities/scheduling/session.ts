import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '$lib/core/utils/validation'

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
  groupedSessionId?: string | null
  activityId?: string | null
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
  readonly groupedSessionId?: string
  readonly activityId?: string
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
    groupedSessionId,
    activityId,
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
    this.groupedSessionId = requireOptionalNonBlank(groupedSessionId, 'groupedSessionId')
    this.activityId = requireOptionalNonBlank(activityId, 'activityId')
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
