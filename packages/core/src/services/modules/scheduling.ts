import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { AttendanceRecord, AttendanceStatus } from '../../entities/scheduling/attendance-record'
import { GroupedSession } from '../../entities/scheduling/grouped-session'
import { PeriodDefinition } from '../../entities/scheduling/period-definition'
import { DayOfWeek, Schedule } from '../../entities/scheduling/schedule'
import { Session, SessionKind } from '../../entities/scheduling/session'
import { normalizeDate } from '../../entities/utils'
import { AttendanceSummary } from '../../value_object/attendance-summary'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'

function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
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

export class SchedulingService {
  constructor(args: ServiceArgs) {
    this.atomicExecution = args.atomicExecution
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.repositories = args.repositories
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly repositories: SchoolRepositories
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']

  async definePeriod({
    id,
    schoolId,
    academicYearId,
    label,
    order,
    startTime,
    endTime,
    isBreak,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    label: string
    order: number
    startTime: string
    endTime: string
    isBreak?: boolean
    createdAt?: Date
  }): Promise<PeriodDefinition> {
    await this.authorize('scheduling.manage', { schoolId, academicYearId })
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const period = new PeriodDefinition({
      id,
      schoolId,
      academicYearId,
      label,
      order,
      startTime,
      endTime,
      isBreak,
      createdAt,
    })
    await this.repositories.periodDefinitions.save(period)
    return period
  }

  async createGroupedSession({
    id,
    schoolId,
    academicYearId,
    academicPeriodId,
    title,
    kind,
    startsAt,
    endsAt,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    academicPeriodId?: string
    title: string
    kind: SessionKind
    startsAt: Date
    endsAt: Date
    createdAt?: Date
  }): Promise<GroupedSession> {
    await this.authorize('scheduling.manage', { schoolId, academicYearId })
    await this.requireSchool(schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      denyResourceAccess()
    }
    if (academicPeriodId) {
      const academicPeriod = await this.requireAcademicPeriod(academicPeriodId)
      if (academicPeriod.schoolId !== schoolId || academicPeriod.academicYearId !== academicYearId) {
        denyResourceAccess()
      }
    }
    const groupedSession = new GroupedSession({
      id,
      schoolId,
      academicYearId,
      academicPeriodId,
      title,
      kind,
      startsAt,
      endsAt,
      createdAt,
    })
    await this.repositories.groupedSessions.save(groupedSession)
    return groupedSession
  }

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
    const classGroup = await this.requireClassGroup(classGroupId)
    await this.authorize('scheduling.manage', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
    })
    await this.requireValidClassSubject(classSubjectId ?? undefined, classGroup.id)
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
    await this.repositories.schedules.save(schedule)
    return schedule
  }

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
    await this.authorize('scheduling.manage', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
    })
    return this.atomicExecution.execute(async () => {
      const schedules = await this.repositories.schedules.list({ classGroupId })
      const calendarEvents = await this.repositories.calendarEvents.list({ academicYearId: classGroup.academicYearId })
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
          const matchingSchedules = schedules.filter((schedule) => {
            if (schedule.isRecurring) {
              return schedule.dayOfWeek === dayOfWeekMap[currentDate.getDay()]
            }
            return schedule.specificDate?.toDateString() === dateString
          })

          for (const schedule of matchingSchedules) {
            const [startH = 0, startM = 0] = schedule.startTime.split(':').map(Number)
            const [endH = 0, endM = 0] = schedule.endTime.split(':').map(Number)
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
            await this.repositories.sessions.save(session)
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

  async createSession({
    id,
    schoolId,
    classGroupId,
    title,
    kind,
    startsAt,
    endsAt,
    classSubjectId,
    createdAt,
  }: {
    id: string
    schoolId: string
    classGroupId: string
    title: string
    kind: SessionKind
    startsAt: Date
    endsAt: Date
    classSubjectId?: string
    createdAt?: Date
  }): Promise<Session> {
    const classGroup = await this.requireClassGroup(classGroupId)
    if (classGroup.schoolId !== schoolId) {
      denyResourceAccess()
    }
    await this.authorize('scheduling.manage', {
      schoolId,
      classGroupId,
      classSubjectId,
    })
    await this.requireValidClassSubject(classSubjectId, classGroup.id)
    const session = new Session({ id, classGroupId, title, kind, startsAt, endsAt, classSubjectId, createdAt })
    await this.repositories.sessions.save(session)
    return session
  }

  async recordAttendance({
    id,
    studentId,
    sessionId,
    status,
    createdAt,
  }: {
    id: string
    studentId: string
    sessionId: string
    status: AttendanceStatus
    createdAt?: Date
  }): Promise<AttendanceRecord> {
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('attendance.record', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: session.classSubjectId,
      sessionId: session.id,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    return this.saveAttendanceRecord({ id, studentId, sessionId, status, createdBy: resolveAuditActorId(this.actor), createdAt })
  }

  async recordSessionAttendance({
    sessionId,
    attendanceByStudent,
    createdAt,
  }: {
    sessionId: string
    attendanceByStudent: Record<string, AttendanceStatus>
    createdAt?: Date
  }): Promise<AttendanceRecord[]> {
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('attendance.record', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: session.classSubjectId,
      sessionId: session.id,
    })
    for (const studentId of Object.keys(attendanceByStudent)) {
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
    }
    const createdBy = resolveAuditActorId(this.actor)
    return this.atomicExecution.execute(async () => {
      const records: AttendanceRecord[] = []
      for (const [studentId, status] of Object.entries(attendanceByStudent)) {
        records.push(await this.saveAttendanceRecord({
          id: `${studentId}-${sessionId}`,
          studentId,
          sessionId,
          status,
          createdBy,
          createdAt,
        }))
      }
      return records
    })
  }

  async buildAttendanceSummary({
    studentId,
    startDate,
    endDate,
  }: {
    studentId: string
    startDate: Date
    endDate: Date
  }): Promise<AttendanceSummary> {
    const student = await this.requireStudent(studentId)
    await this.authorize('attendance.read', {
      schoolId: student.schoolId,
      studentId: student.id,
    })
    const records = await this.repositories.attendance.list({
      studentId,
      date: { $gte: normalizeDate(startDate), $lte: normalizeDate(endDate) },
    })
    let presentCount = 0
    let absenceCount = 0
    let lateCount = 0
    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.Present:
          presentCount += 1
          break
        case AttendanceStatus.Absent:
          absenceCount += 1
          break
        case AttendanceStatus.Late:
          lateCount += 1
          break
      }
    }
    return new AttendanceSummary({ presentCount, absenceCount, lateCount })
  }

  async listSessionAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('attendance.read', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: session.classSubjectId,
      sessionId: session.id,
    })
    return this.repositories.attendance.list({ sessionId })
  }

  private async saveAttendanceRecord({
    id,
    studentId,
    sessionId,
    status,
    createdBy,
    createdAt,
  }: {
    id: string
    studentId: string
    sessionId: string
    status: AttendanceStatus
    createdBy?: string
    createdAt?: Date
  }): Promise<AttendanceRecord> {
    await this.requireStudent(studentId)
    const session = await this.requireSession(sessionId)
    await this.requireEnrollmentForClassGroup({ studentId, classGroupId: session.classGroupId })
    const existing = await this.repositories.attendance.findByStudentAndSession(studentId, sessionId)
    const record = new AttendanceRecord({
      id: existing?.id ?? id,
      studentId,
      sessionId,
      date: session.startsAt,
      status,
      createdBy: createdBy ?? existing?.createdBy,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.repositories.attendance.save(record)
    return record
  }

  private async requireSchool(schoolId: string): Promise<void> {
    if (!await this.repositories.schools.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
  }

  private async requireAcademicYear(academicYearId: string): Promise<AcademicYear> {
    const academicYear = await this.repositories.academicYears.findById(academicYearId)
    if (!academicYear) {
      denyResourceAccess()
    }
    return academicYear
  }

  private async requireAcademicPeriod(academicPeriodId: string): Promise<AcademicPeriod> {
    const academicPeriod = await this.repositories.academicPeriods.findById(academicPeriodId)
    if (!academicPeriod) {
      denyResourceAccess()
    }
    return academicPeriod
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async requireSession(sessionId: string): Promise<Session> {
    const session = await this.repositories.sessions.findById(sessionId)
    if (!session) {
      denyResourceAccess()
    }
    return session
  }

  private async requireStudent(studentId: string) {
    const student = await this.repositories.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  private async requireStudentInSchool(studentId: string, schoolId: string): Promise<void> {
    const student = await this.repositories.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireEnrollmentForClassGroup({
    studentId,
    classGroupId,
  }: {
    studentId: string
    classGroupId: string
  }): Promise<void> {
    const enrollments = await this.repositories.enrollments.list({ studentId })
    if (!enrollments.some(enrollment => enrollment.classGroupId === classGroupId)) {
      throw new Error(`Student ${studentId} is not enrolled in classGroup ${classGroupId}`)
    }
  }

  private async requireValidClassSubject(classSubjectId: string | undefined, classGroupId: string): Promise<void> {
    if (!classSubjectId) {
      return
    }
    const classSubject = await this.repositories.classSubjects.findById(classSubjectId)
    if (!classSubject || classSubject.classGroupId !== classGroupId) {
      denyResourceAccess()
    }
  }

  private async authorize(
    action: 'scheduling.manage' | 'attendance.record' | 'attendance.read',
    resource: {
      schoolId: string
      academicYearId?: string
      classGroupId?: string
      classSubjectId?: string
      sessionId?: string
      studentId?: string
    },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}
