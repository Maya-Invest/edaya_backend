import type { SessionKind } from './session'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../../utils/validation'

export interface GroupedSessionArgs {
  id: string
  schoolId: string
  academicYearId: string
  academicPeriodId?: string | null
  title: string
  kind: SessionKind
  startsAt: Date
  endsAt: Date
  createdAt?: Date
}

/**
 * Represents a session that involves multiple classes simultaneously.
 * The underlying class-specific sessions will reference this grouped session.
 */
export class GroupedSession {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly academicPeriodId?: string
  readonly title: string
  readonly kind: SessionKind
  readonly startsAt: Date
  readonly endsAt: Date
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    academicPeriodId,
    title,
    kind,
    startsAt,
    endsAt,
    createdAt,
  }: GroupedSessionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.academicPeriodId = requireOptionalNonBlank(academicPeriodId, 'academicPeriodId')
    this.title = requireNonBlank(title, 'title')
    this.kind = kind
    this.startsAt = requireValidDate(startsAt, 'startsAt')
    this.endsAt = requireValidDate(endsAt, 'endsAt')
    this.createdAt = createdAt ?? new Date()

    if (this.endsAt.getTime() <= this.startsAt.getTime()) {
      throw new Error('endsAt must be after startsAt')
    }
  }

  get durationMinutes(): number {
    return Math.round((this.endsAt.getTime() - this.startsAt.getTime()) / 60000)
  }
}
