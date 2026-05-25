import type { CalendarEvent } from '../entities/scheduling/calendar-event'
import type { BaseRepositoryInterface } from './_base-repository'

export interface CalendarEventRepository extends BaseRepositoryInterface<CalendarEvent> {
  listBySchool: (schoolId: string) => Promise<CalendarEvent[]>
  listByAcademicYear: (academicYearId: string) => Promise<CalendarEvent[]>
}
