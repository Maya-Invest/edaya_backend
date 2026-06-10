import type { AttendanceStatus, CalendarEventInput, ClassGroup, ScheduleInput, SessionInput } from '../../domains'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess, Permission, resolveAuditActorId } from '../../authorization'
import {
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceRecord,
  CalendarEvent,
  CalendarEventScopeKind,
  DayOfWeek,
  Schedule,
  Session,
  SessionKind,
  StudentClassEnrollmentStatus,
} from '../../domains'
import { normalizeDate } from '../../domains/utils'
import { permissionAction } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

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

export interface GenerateSessionsInput {
  classGroupId: string
  startDate: Date
  endDate: Date
}

export interface RecordAttendanceInput {
  id: string
  studentId: string
  sessionId: string
  status: AttendanceStatus
  createdAt?: Date
}

export interface RecordDailyAttendanceInput {
  id: string
  classGroupId: string
  studentId: string
  date: Date
  status: AttendanceStatus
  createdAt?: Date
}

export interface RecordSessionAttendanceInput {
  sessionId: string
  attendanceByStudent: Record<string, AttendanceStatus>
  createdAt?: Date
}

export interface RecordClassDailyAttendanceInput {
  classGroupId: string
  date: Date
  attendanceByStudent: Record<string, AttendanceStatus>
  createdAt?: Date
}

export type CreateScheduleInput = ScheduleInput
export type CreateCalendarEventInput = CalendarEventInput
export type CreateSessionInput = SessionInput

export interface ReviewAttendanceJustificationInput {
  studentId: string
  sessionId: string
  decision?: AttendanceJustificationStatus
  reason?: string
}

export class SchedulingServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async createSchedule(input: CreateScheduleInput): Promise<Schedule> {
    await this.checkModule('scheduling')
    const schedule = new Schedule(input)
    await this.baseService.schedules.save(schedule)
    return schedule
  }

  async createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    await this.checkModule('scheduling', input.schoolId)
    const event = new CalendarEvent(input)
    await this.baseService.calendarEvents.save(event)
    return event
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    await this.checkModule('scheduling')
    const session = new Session(input)
    await this.baseService.sessions.save(session)
    return session
  }

  async generateSessions({
    classGroupId,
    startDate,
    endDate,
  }: GenerateSessionsInput): Promise<Session[]> {
    await this.checkModule('scheduling')
    const classGroup = await this.requireClassGroup(classGroupId)
    await this.authorizeTimetableCreate(classGroup)
    return this.baseService.atomicExecution.execute(async () => {
      const schedules = await this.baseService.repositories.schedules.list({ classGroupId })
      const calendarEvents = await this.baseService.repositories.calendarEvents.list({ academicYearId: classGroup.academicYearId })
      const nonSchoolDates = new Set<string>()

      for (const event of calendarEvents) {
        const appliesToClass = event.scopeKind === CalendarEventScopeKind.School
          || (event.scopeKind === CalendarEventScopeKind.ClassGroup && event.scopeId === classGroup.id)
          || (event.scopeKind === CalendarEventScopeKind.GradeLevel && event.scopeId === classGroup.gradeLevelId)
        if (event.isNonSchoolDay && appliesToClass) {
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
            await this.baseService.sessions.save(session, { moduleChecked: true })
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

  async recordAttendance({
    id,
    studentId,
    sessionId,
    status,
    createdAt,
  }: RecordAttendanceInput): Promise<AttendanceRecord> {
    await this.checkModule('attendance')
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorizeAttendanceRecord({
      classGroup,
      session,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    return this.saveAttendanceRecord({
      id,
      studentId,
      sessionId,
      status,
      createdBy: resolveAuditActorId(this.baseService.actor),
      createdAt,
    })
  }

  async recordDailyAttendance({
    id,
    classGroupId,
    studentId,
    date,
    status,
    createdAt,
  }: RecordDailyAttendanceInput): Promise<AttendanceRecord> {
    await this.checkModule('attendance')
    const classGroup = await this.requireClassGroup(classGroupId)
    this.requireDailyAttendanceMode(classGroup)
    await this.authorizeAttendanceRecord({ classGroup, studentId })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    await this.requireEnrollmentForClassGroup({ studentId, classGroupId: classGroup.id })
    const createdBy = resolveAuditActorId(this.baseService.actor)
    return this.baseService.atomicExecution.execute(async () => {
      const session = await this.getOrCreateDailyAttendanceSession(classGroup, date, createdAt)
      return this.saveAttendanceRecord({
        id,
        studentId,
        sessionId: session.id,
        status,
        createdBy,
        createdAt,
      })
    })
  }

  async recordSessionAttendance({
    sessionId,
    attendanceByStudent,
    createdAt,
  }: RecordSessionAttendanceInput): Promise<AttendanceRecord[]> {
    await this.checkModule('attendance')
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorizeAttendanceRecord({ classGroup, session })
    for (const studentId of Object.keys(attendanceByStudent)) {
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
    }
    const createdBy = resolveAuditActorId(this.baseService.actor)
    return this.baseService.atomicExecution.execute(async () => {
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

  async recordClassDailyAttendance({
    classGroupId,
    date,
    attendanceByStudent,
    createdAt,
  }: RecordClassDailyAttendanceInput): Promise<AttendanceRecord[]> {
    await this.checkModule('attendance')
    const classGroup = await this.requireClassGroup(classGroupId)
    this.requireDailyAttendanceMode(classGroup)
    await this.authorizeAttendanceRecord({ classGroup })
    for (const studentId of Object.keys(attendanceByStudent)) {
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
      await this.requireEnrollmentForClassGroup({ studentId, classGroupId: classGroup.id })
    }
    const createdBy = resolveAuditActorId(this.baseService.actor)
    return this.baseService.atomicExecution.execute(async () => {
      const session = await this.getOrCreateDailyAttendanceSession(classGroup, date, createdAt)
      const records: AttendanceRecord[] = []
      for (const [studentId, status] of Object.entries(attendanceByStudent)) {
        records.push(await this.saveAttendanceRecord({
          id: `${studentId}-${session.id}`,
          studentId,
          sessionId: session.id,
          status,
          createdBy,
          createdAt,
        }))
      }
      return records
    })
  }

  async reviewAttendanceJustification({
    studentId,
    sessionId,
    decision,
    reason,
  }: ReviewAttendanceJustificationInput): Promise<AttendanceRecord> {
    await this.checkModule('attendance')
    const existing = await this.requireOne(this.baseService.attendance, { studentId, sessionId })
    const record = existing.copyWith({
      justificationStatus: decision ?? AttendanceJustificationStatus.Excused,
      reason,
      justifiedAt: new Date(),
      justifiedByStaffId: resolveAuditActorId(this.baseService.actor),
    })
    await this.baseService.attendance.save(record)
    return record
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
    const existing = await this.baseService.repositories.attendance.findOne({ studentId, sessionId })
    const isCorrection = existing !== undefined && existing.status !== status
    const updatedAt = isCorrection ? (createdAt ?? new Date()) : existing?.updatedAt ?? createdAt
    const record = new AttendanceRecord({
      id: existing?.id ?? id,
      studentId,
      sessionId,
      date: session.startsAt,
      status,
      justificationStatus: isCorrection ? AttendanceJustificationStatus.None : existing?.justificationStatus,
      reason: isCorrection ? undefined : existing?.reason,
      notes: isCorrection ? undefined : existing?.notes,
      justifiedAt: isCorrection ? undefined : existing?.justifiedAt,
      justifiedByStaffId: isCorrection ? undefined : existing?.justifiedByStaffId,
      correctedAt: isCorrection ? updatedAt : existing?.correctedAt,
      correctedByStaffId: isCorrection ? createdBy : existing?.correctedByStaffId,
      createdBy: existing?.createdBy ?? createdBy,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt,
    })
    await this.baseService.attendance.save(record, { moduleChecked: true })
    return record
  }

  private requireDailyAttendanceMode(classGroup: ClassGroup): void {
    if (classGroup.attendanceMode !== AttendanceMode.Daily) {
      throw new BusinessRuleViolationError('DAILY_ATTENDANCE_MODE_REQUIRED', `Class group ${classGroup.id} is not configured for daily attendance`)
    }
  }

  private async getOrCreateDailyAttendanceSession(
    classGroup: ClassGroup,
    date: Date,
    createdAt?: Date,
  ): Promise<Session> {
    const normalizedDate = normalizeDate(date)
    const sessionId = this.buildDailyAttendanceSessionId(classGroup.id, normalizedDate)
    const existing = await this.baseService.repositories.sessions.findById(sessionId)
    if (existing) {
      if (existing.classGroupId !== classGroup.id || !this.isDailyAttendanceSession(existing, normalizedDate)) {
        denyResourceAccess()
      }
      return existing
    }
    const endsAt = new Date(normalizedDate)
    endsAt.setUTCDate(endsAt.getUTCDate() + 1)
    const session = new Session({
      id: sessionId,
      classGroupId: classGroup.id,
      title: 'Daily attendance',
      kind: SessionKind.Other,
      startsAt: normalizedDate,
      endsAt,
      createdAt,
    })
    await this.baseService.sessions.save(session, { moduleChecked: true })
    return session
  }

  private buildDailyAttendanceSessionId(classGroupId: string, date: Date): string {
    return `daily:${classGroupId}:${date.toISOString().slice(0, 10)}`
  }

  private isDailyAttendanceSession(session: Session, date: Date): boolean {
    return session.kind === SessionKind.Other
      && session.title === 'Daily attendance'
      && normalizeDate(session.startsAt).getTime() === date.getTime()
  }

  private async requireSession(sessionId: string): Promise<Session> {
    const session = await this.baseService.repositories.sessions.findById(sessionId)
    if (!session) {
      denyResourceAccess()
    }
    const classGroup = await this.baseService.repositories.classGroups.findById(session.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return session
  }

  private async requireStudentInSchool(studentId: string, schoolId: string): Promise<void> {
    const student = await this.baseService.repositories.students.findById(studentId)
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
    const enrollments = await this.baseService.repositories.enrollments.list({
      studentId,
      classGroupId,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (enrollments.length === 0) {
      throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${studentId} does not have an active enrollment in classGroup ${classGroupId}`)
    }
  }

  private async authorizeAttendanceRecord({
    classGroup,
    session,
    studentId,
  }: {
    classGroup: ClassGroup
    session?: Session
    studentId?: string
  }): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)
    await permissionAction(Permission.ATTENDANCE_RECORD, {
      scopeType: 'class_group',
      scopeEntityId: classGroup.id,
    })(this.baseService.actor)
    if (classGroup.id) {
      await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [classGroup.id])
    }
    if (session) {
      await this.baseService.authorizationPolicy.checkSessionAccess(this.baseService.actor, [session.id])
    }
    if (studentId) {
      await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [studentId])
    }
  }

  private async authorizeTimetableCreate(classGroup: ClassGroup): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)
    await permissionAction(Permission.TIMETABLE_CREATE, {
      scopeType: 'class_group',
      scopeEntityId: classGroup.id,
    })(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [classGroup.id])
  }

  private async requireOne<T>(
    managedService: { findOne: (filter: Record<string, unknown>) => Promise<T | undefined> },
    filter: Record<string, unknown>,
  ): Promise<T> {
    const entity = await managedService.findOne(filter)
    if (!entity) {
      denyResourceAccess()
    }
    return entity
  }
}
