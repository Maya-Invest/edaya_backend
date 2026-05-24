import type { CalendarEvent } from '$lib/core/entities/scheduling/calendar-event'
import type { BaseRepositoryInterface } from './_base-repository'

export interface CalendarEventRepository extends BaseRepositoryInterface<CalendarEvent> {
  listBySchool: (schoolId: string) => Promise<CalendarEvent[]>
  listByAcademicYear: (academicYearId: string) => Promise<CalendarEvent[]>
}
