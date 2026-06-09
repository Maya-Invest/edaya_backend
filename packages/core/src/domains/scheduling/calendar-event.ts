import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { directPermissionEntityConfig } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

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

export const calendarEventBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  startDate: zodDate(),
  endDate: zodDate(),
  kind: z.nativeEnum(CalendarEventKind),
  isNonSchoolDay: z.boolean().default(false),
  scopeKind: z.nativeEnum(CalendarEventScopeKind).default(CalendarEventScopeKind.School),
  scopeId: z.string().trim().min(1, 'scopeId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineCalendarEvent(data: any, ctx: z.RefinementCtx) {
  if (data.endDate.getTime() < data.startDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endDate must not be before startDate',
    })
  }
  if (data.scopeKind !== CalendarEventScopeKind.School && !data.scopeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scopeId is required for scoped calendar events',
    })
  }
  if (data.scopeKind === CalendarEventScopeKind.School && data.scopeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'school-wide calendar events must not define scopeId',
    })
  }
}

export const calendarEventSchema = calendarEventBaseSchema.superRefine(refineCalendarEvent)

export type CalendarEventData = z.infer<typeof calendarEventSchema>

export const calendarEventCreateSchema = calendarEventBaseSchema.omit({ createdAt: true }).superRefine(refineCalendarEvent)
export const calendarEventUpdateSchema = calendarEventBaseSchema.partial().required({ id: true }).superRefine(refineCalendarEvent)

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
  readonly data: CalendarEventData

  constructor(args: CalendarEventArgs) {
    const result = calendarEventSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get title() { return this.data.title }
  get startDate() { return this.data.startDate }
  get endDate() { return this.data.endDate }
  get kind() { return this.data.kind }
  get isNonSchoolDay() { return this.data.isNonSchoolDay }
  get scopeKind() { return this.data.scopeKind }
  get scopeId() { return this.data.scopeId }
  get createdAt() { return this.data.createdAt }

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
