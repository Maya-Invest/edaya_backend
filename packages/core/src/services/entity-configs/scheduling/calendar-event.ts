import type { CalendarEvent } from '../../../entities/scheduling/calendar-event'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared/common'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { CalendarEventScopeKind } from '../../../entities/scheduling/calendar-event'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { directEntityConfig } from '../../../shared/common'

export const calendarEventConfig: EntityConfigFactory<CalendarEvent> = (input) => {
  const config = directEntityConfig(input, input.repositories.calendarEvents, 'queries.read_calendar', 'scheduling.manage')
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
