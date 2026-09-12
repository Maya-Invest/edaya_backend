import { Permission } from '@edaya/core';
import type { CalendarEvent } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { BusinessRuleViolationError, CalendarEventScopeKind } from '@edaya/core';
import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/scheduling/calendar-event.ts (PR3)
export const calendarEventConfig: EntityConfigFactory<CalendarEvent> = ({ repositories, atomicExecution }) => ({
  ...config({
    repository: repositories.calendarEvents,
    tenant: directSchoolTenant(),
    authorization: { resource: 'calendarEvents', read: [Permission.QUERY_CALENDAR_READ], write: [Permission.TIMETABLE_UPDATE] },
    
    atomicExecution,
  }),
  gates: {
    preSave: validateCalendarEventSave,
  },
})

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
