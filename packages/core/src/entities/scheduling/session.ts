import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '$lib/core/utils/validation'

export enum SessionKind {
  Course = 'course',
  Evaluation = 'evaluation',
  Event = 'event',
  Other = 'other',
}

export interface SessionArgs {
  id: string
  classroomId: string
  title: string
  kind: SessionKind
  startsAt: Date
  endsAt: Date
  moduleId?: string | null
  groupedSessionId?: string | null
  activityId?: string | null
  timetableSlotId?: string | null
  createdAt?: Date
}

/**
 * Represents a concrete scheduled time slot where a classroom activity actually happens.
 * Sessions may be generated from a TimetableSlot (linked via timetableSlotId) or
 * created ad-hoc for exceptional events. Attendance is recorded against sessions.
 */
export class Session {
  readonly id: string
  readonly classroomId: string
  readonly title: string
  readonly kind: SessionKind
  readonly startsAt: Date
  readonly endsAt: Date
  readonly moduleId?: string
  readonly groupedSessionId?: string
  readonly activityId?: string
  readonly timetableSlotId?: string
  readonly createdAt: Date

  constructor({
    id,
    classroomId,
    title,
    kind,
    startsAt,
    endsAt,
    moduleId,
    groupedSessionId,
    activityId,
    timetableSlotId,
    createdAt,
  }: SessionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classroomId = requireNonBlank(classroomId, 'classroomId')
    this.title = requireNonBlank(title, 'title')
    this.kind = kind
    this.startsAt = requireValidDate(startsAt, 'startsAt')
    this.endsAt = requireValidDate(endsAt, 'endsAt')
    this.moduleId = requireOptionalNonBlank(moduleId, 'moduleId')
    this.groupedSessionId = requireOptionalNonBlank(groupedSessionId, 'groupedSessionId')
    this.activityId = requireOptionalNonBlank(activityId, 'activityId')
    this.timetableSlotId = requireOptionalNonBlank(timetableSlotId, 'timetableSlotId')
    this.createdAt = createdAt ?? new Date()

    if (this.endsAt.getTime() <= this.startsAt.getTime()) {
      throw new Error('endsAt must be after startsAt')
    }
  }

  get durationMinutes(): number {
    return Math.round((this.endsAt.getTime() - this.startsAt.getTime()) / 60000)
  }
}
