import { requireNonBlank, requireValidDate } from '$lib/core/utils/validation'

export enum CalendarEventKind {
  Holiday = 'holiday',
  ExamPeriod = 'exam_period',
  Break = 'break',
  Event = 'event',
  Other = 'other',
}

export interface CalendarEventArgs {
  id: string
  schoolId: string
  academicYearId: string
  title: string
  startDate: Date
  endDate: Date
  kind: CalendarEventKind
  isNonSchoolDay?: boolean
  createdAt?: Date
}

/**
 * Represents a school-wide calendar event such as a holiday, exam period, break, or special event.
 * Non-school days are used to skip session generation from the timetable grid and
 * to calculate effective school days for attendance reporting.
 */
export class CalendarEvent {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly title: string
  readonly startDate: Date
  readonly endDate: Date
  readonly kind: CalendarEventKind
  readonly isNonSchoolDay: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    title,
    startDate,
    endDate,
    kind,
    isNonSchoolDay = false,
    createdAt,
  }: CalendarEventArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.title = requireNonBlank(title, 'title')
    this.startDate = requireValidDate(startDate, 'startDate')
    this.endDate = requireValidDate(endDate, 'endDate')
    this.kind = kind
    this.isNonSchoolDay = isNonSchoolDay
    this.createdAt = createdAt ?? new Date()

    if (this.endDate.getTime() < this.startDate.getTime()) {
      throw new Error('endDate must not be before startDate')
    }
  }

  /** Returns the number of calendar days this event spans (inclusive). */
  get durationDays(): number {
    const msPerDay = 86_400_000
    return Math.round((this.endDate.getTime() - this.startDate.getTime()) / msPerDay) + 1
  }
}
