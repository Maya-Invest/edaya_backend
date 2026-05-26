import type { ClassGroup } from '../../entities/school/class-group'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { DayOfWeek, Schedule } from '../../entities/scheduling/schedule'
import { Session, SessionKind } from '../../entities/scheduling/session'

function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export interface ScheduleServiceArgs {
  atomicExecution: AtomicExecutionPort
  classGroupRepository: SchoolRepositories['classGroups']
  scheduleRepository: SchoolRepositories['schedules']
  calendarEventRepository: SchoolRepositories['calendarEvents']
  sessionRepository: SchoolRepositories['sessions']
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
    this.atomicExecution = args.atomicExecution
    this.classGroups = args.classGroupRepository
    this.schedules = args.scheduleRepository
    this.calendarEvents = args.calendarEventRepository
    this.sessions = args.sessionRepository
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly schedules: SchoolRepositories['schedules']
  private readonly calendarEvents: SchoolRepositories['calendarEvents']
  private readonly sessions: SchoolRepositories['sessions']

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
    return this.atomicExecution.execute(async () => {
      const classGroup = await this.requireClassGroup(classGroupId)
      const schedules = await this.schedules.list({ classGroupId })
      const calendarEvents = await this.calendarEvents.list({ academicYearId: classGroup.academicYearId })

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

      let currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateString = currentDate.toDateString()

        if (!nonSchoolDates.has(dateString)) {
          const dayOfWeekVal = dayOfWeekMap[currentDate.getDay()]

          const matchingSchedules = schedules.filter((s) => {
            if (s.isRecurring) {
              return s.dayOfWeek === dayOfWeekVal
            }
            else {
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

        const nextDate = new Date(currentDate)
        nextDate.setDate(nextDate.getDate() + 1)
        currentDate = nextDate
      }

      return generatedSessions
    })
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }
}
