import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '$lib/core/utils/validation'

export enum CalendarEventKind {
  Holiday = 'holiday',
  ExamPeriod = 'exam_period',
  Break = 'break',
  Event = 'event',
  Other = 'other',
}

export enum CalendarEventScopeKind {
  School = 'school',
  GradeLevel = 'grade_level',
  ClassGroup = 'class_group',
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
  scopeKind?: CalendarEventScopeKind
  scopeId?: string | null
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
  readonly scopeKind: CalendarEventScopeKind
  readonly scopeId?: string
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
    scopeKind = CalendarEventScopeKind.School,
    scopeId,
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
    this.scopeKind = scopeKind
    this.scopeId = requireOptionalNonBlank(scopeId, 'scopeId')
    this.createdAt = createdAt ?? new Date()

    if (this.endDate.getTime() < this.startDate.getTime()) {
      throw new Error('endDate must not be before startDate')
    }
    if (this.scopeKind !== CalendarEventScopeKind.School && !this.scopeId) {
      throw new Error('scopeId is required for scoped calendar events')
    }
    if (this.scopeKind === CalendarEventScopeKind.School && this.scopeId) {
      throw new Error('school-wide calendar events must not define scopeId')
    }
  }

  /** Returns the number of calendar days this event spans (inclusive). */
  get durationDays(): number {
    const msPerDay = 86_400_000
    return Math.round((this.endDate.getTime() - this.startDate.getTime()) / msPerDay) + 1
  }
}
