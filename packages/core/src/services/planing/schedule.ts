import type { ClassGroup } from '$lib/core/entities/core/class-group'
import type { CalendarEventRepository } from '$lib/core/ports/calendar-event-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { ScheduleRepository } from '$lib/core/ports/schedule-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import { DayOfWeek, Schedule } from '$lib/core/entities/scheduling/schedule'
import { Session, SessionKind } from '$lib/core/entities/scheduling/session'

function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export interface ScheduleServiceArgs {
  classGroupRepository: ClassGroupRepository
  scheduleRepository: ScheduleRepository
  calendarEventRepository: CalendarEventRepository
  sessionRepository: SessionRepository
}

const dayOfWeekMap: Record<number, DayOfWeek> = {
  0: DayOfWeek.Sunday,
  1: DayOfWeek.Monday,
  2: DayOfWeek.Tuesday,
  3: DayOfWeek.Wednesday,
  4: DayOfWeek.Thursday,
  5: DayOfWeek.Friday,
  6: DayOfWeek.Saturday,
}

export class ScheduleService {
  constructor(args: ScheduleServiceArgs) {
    this.classGroups = args.classGroupRepository
    this.schedules = args.scheduleRepository
    this.calendarEvents = args.calendarEventRepository
    this.sessions = args.sessionRepository
  }

  private readonly classGroups: ClassGroupRepository
  private readonly schedules: ScheduleRepository
  private readonly calendarEvents: CalendarEventRepository
  private readonly sessions: SessionRepository

  /**
   * Defines a schedule template (recurring or one-off) for a class group.
   */
  async createSchedule({
    id,
    classGroupId,
    classSubjectId,
    title,
    isRecurring,
    dayOfWeek,
    startTime,
    endTime,
    specificDate,
    createdAt,
  }: {
    id: string
    classGroupId: string
    classSubjectId?: string | null
    title: string
    isRecurring: boolean
    dayOfWeek?: DayOfWeek | null
    startTime: string
    endTime: string
    specificDate?: Date | null
    createdAt?: Date
  }): Promise<Schedule> {
    await this.requireClassGroup(classGroupId)

    const schedule = new Schedule({
      id,
      classGroupId,
      classSubjectId,
      title,
      isRecurring,
      dayOfWeek,
      startTime,
      endTime,
      specificDate,
      createdAt,
    })
    await this.schedules.save(schedule)
    return schedule
  }

  /**
   * Session Generation Engine:
   * Maps abstract Schedule templates into concrete calendar Session instances within a date range,
   * skipping designated school holidays and breaks.
   */
  async generateSessions({
    classGroupId,
    startDate,
    endDate,
  }: {
    classGroupId: string
    startDate: Date
    endDate: Date
  }): Promise<Session[]> {
    const classGroup = await this.requireClassGroup(classGroupId)
    const schedules = await this.schedules.listByClassGroup(classGroupId)
    const calendarEvents = await this.calendarEvents.listByAcademicYear(classGroup.academicYearId)

    // Build set of dates that are non-school days (holidays/breaks)
    const nonSchoolDates = new Set<string>()
    for (const event of calendarEvents) {
      if (event.isNonSchoolDay) {
        const current = new Date(event.startDate)
        while (current <= event.endDate) {
          nonSchoolDates.add(current.toDateString())
          current.setDate(current.getDate() + 1)
        }
      }
    }

    const generatedSessions: Session[] = []

    // Loop through each calendar day in the range
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateString = currentDate.toDateString()

      // Skip holidays and breaks
      if (!nonSchoolDates.has(dateString)) {
        const dayOfWeekVal = dayOfWeekMap[currentDate.getDay()]

        // Find all matching templates for this calendar day
        const matchingSchedules = schedules.filter(s => {
          if (s.isRecurring) {
            return s.dayOfWeek === dayOfWeekVal
          } else {
            return s.specificDate && s.specificDate.toDateString() === dateString
          }
        })

        for (const schedule of matchingSchedules) {
          const startParts = schedule.startTime.split(':').map(Number)
          const endParts = schedule.endTime.split(':').map(Number)
          const startH = startParts[0] ?? 0
          const startM = startParts[1] ?? 0
          const endH = endParts[0] ?? 0
          const endM = endParts[1] ?? 0

          const sessionStartsAt = new Date(currentDate)
          sessionStartsAt.setHours(startH, startM, 0, 0)

          const sessionEndsAt = new Date(currentDate)
          sessionEndsAt.setHours(endH, endM, 0, 0)

          const session = new Session({
            id: generateUniqueId(),
            classGroupId: classGroup.id,
            title: schedule.title,
            kind: SessionKind.Course,
            startsAt: sessionStartsAt,
            endsAt: sessionEndsAt,
            classSubjectId: schedule.classSubjectId,
            scheduleId: schedule.id,
          })

          await this.sessions.save(session)
          generatedSessions.push(session)
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return generatedSessions
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }
}
