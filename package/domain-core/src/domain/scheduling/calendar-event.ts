import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { directPermissionEntityConfig } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { dateRangeDurationDays, refineEndDateNotBeforeStartDate } from '../../domain/value-objects/date-range'
import { parseDomain, zodDate } from '../shared/utils'

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
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  startDate: zodDate(),
  endDate: zodDate(),
  kind: z.nativeEnum(CalendarEventKind),
  isNonSchoolDay: z.boolean().default(false),
  scopeKind: z.nativeEnum(CalendarEventScopeKind).default(CalendarEventScopeKind.School),
  scopeId: z.string().trim().min(1, 'scopeId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineCalendarEvent(data: any, ctx: z.RefinementCtx) {
  refineEndDateNotBeforeStartDate(data, ctx)
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
export type CalendarEventInput = z.input<typeof calendarEventSchema>

export const calendarEventCreateSchema = calendarEventBaseSchema.omit({ createdAt: true }).superRefine(refineCalendarEvent)
export const calendarEventUpdateSchema = calendarEventBaseSchema.partial().required({ id: true }).superRefine(refineCalendarEvent)

/**
 * Represents a school-wide calendar event such as a holiday, break, or special event.
 * Non-school days are used to skip session generation from the timetable grid and
 * to calculate effective school days for attendance reporting.
 */
export class CalendarEvent {
  readonly data: CalendarEventData

  constructor(args: CalendarEventInput) {
    this.data = parseDomain(calendarEventSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get title() { return this.data.title }
  get description() { return this.data.description }
  get startDate() { return this.data.startDate }
  get endDate() { return this.data.endDate }
  get kind() { return this.data.kind }
  get isNonSchoolDay() { return this.data.isNonSchoolDay }
  get scopeKind() { return this.data.scopeKind }
  get scopeId() { return this.data.scopeId }
  get createdAt() { return this.data.createdAt }

  /** Returns the number of calendar days this event spans (inclusive). */
  get durationDays(): number {
    return dateRangeDurationDays(this.startDate, this.endDate)
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
