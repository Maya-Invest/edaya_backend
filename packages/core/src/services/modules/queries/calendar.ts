import type { CalendarEvent } from '../../../entities/scheduling/calendar-event'
import type { AcademicYear } from '../../../entities/school/academic-year'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { CalendarEventScopeKind } from '../../../entities/scheduling/calendar-event'
import { denyResourceAccess } from '../../authorization'

export interface AcademicCalendar {
  academicYear: AcademicYear
  classGroup?: ClassGroup
  events: CalendarEvent[]
}

export class CalendarReadService {
  constructor(args: ServiceArgs) {
    this.academicYears = args.repositories.academicYears
    this.classGroups = args.repositories.classGroups
    this.calendarEvents = args.repositories.calendarEvents
  }

  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly calendarEvents: SchoolRepositories['calendarEvents']

  async getCalendarEvents({
    schoolId,
    academicYearId,
    classGroupId,
  }: {
    schoolId: string
    academicYearId: string
    classGroupId?: string
  }): Promise<AcademicCalendar> {
    const academicYear = await this.academicYears.findById(academicYearId)
    const classGroup = classGroupId ? await this.classGroups.findById(classGroupId) : undefined
    if (
      !academicYear
      || academicYear.schoolId !== schoolId
      || (classGroupId !== undefined && (
        !classGroup
        || classGroup.schoolId !== schoolId
        || classGroup.academicYearId !== academicYear.id
      ))
    ) {
      denyResourceAccess()
    }
    const events = (await this.calendarEvents.list({ schoolId, academicYearId }))
      .filter(event =>
        !classGroup
        || event.scopeKind === CalendarEventScopeKind.School
        || (event.scopeKind === CalendarEventScopeKind.GradeLevel && event.scopeId === classGroup.gradeLevelId)
        || (event.scopeKind === CalendarEventScopeKind.ClassGroup && event.scopeId === classGroup.id))
      .sort((left, right) =>
        left.startDate.getTime() - right.startDate.getTime()
        || left.endDate.getTime() - right.endDate.getTime()
        || left.title.localeCompare(right.title)
        || left.id.localeCompare(right.id))
    return { academicYear, classGroup, events }
  }
}
