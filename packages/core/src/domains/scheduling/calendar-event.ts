import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { directPermissionEntityConfig } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum CalendarEventKind {
  Holiday = 'holiday',
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
 * Represents a school-wide calendar event such as a holiday, break, or special event.
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

export const calendarEventConfig: EntityConfigFactory<CalendarEvent> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.calendarEvents,
    Permission.QUERY_CALENDAR_READ,
    Permission.TIMETABLE_UPDATE,
  )
  return {
    ...config,
    gates: {
      preSave: validateCalendarEventSave,
    },
  }
}

export async function validateCalendarEventSave(
  event: CalendarEvent,
  _existing: CalendarEvent | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const academicYear = await repositories.academicYears.findById(event.academicYearId)
  if (!academicYear || academicYear.schoolId !== event.schoolId) {
    denyResourceAccess()
  }
  if (event.startDate.getTime() < academicYear.startDate.getTime() || event.endDate.getTime() > academicYear.endDate.getTime()) {
    throw new BusinessRuleViolationError('CALENDAR_EVENT_OUT_OF_YEAR', `Calendar event ${event.id} must fit within academic year ${event.academicYearId}`)
  }
  if (event.scopeKind === CalendarEventScopeKind.ClassGroup) {
    const classGroup = event.scopeId ? await repositories.classGroups.findById(event.scopeId) : undefined
    if (!classGroup || classGroup.schoolId !== event.schoolId || classGroup.academicYearId !== event.academicYearId) {
      denyResourceAccess()
    }
  }
  if (event.scopeKind === CalendarEventScopeKind.GradeLevel) {
    const gradeLevel = event.scopeId ? await repositories.gradeLevels.findById(event.scopeId) : undefined
    if (!gradeLevel || gradeLevel.schoolId !== event.schoolId) {
      denyResourceAccess()
    }
  }
}
