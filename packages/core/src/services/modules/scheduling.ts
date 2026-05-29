import type { CalendarEventKind } from '../../entities/scheduling/calendar-event'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus } from '../../entities/scheduling/attendance-record'
import { CalendarEvent, CalendarEventScopeKind } from '../../entities/scheduling/calendar-event'
import { PeriodDefinition } from '../../entities/scheduling/period-definition'
import { DayOfWeek, Schedule } from '../../entities/scheduling/schedule'
import { Session, SessionKind } from '../../entities/scheduling/session'
import { AttendanceMode } from '../../entities/school/class-group'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { normalizeDate } from '../../entities/utils'
import { AttendanceSummary } from '../../value_object/attendance-summary'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { requireSchool } from '../shared/require-school'

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
    await requireSchool(this.repositories.schools, schoolId)
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

  async createCalendarEvent({
    id,
    schoolId,
    academicYearId,
    title,
    startDate,
    endDate,
    kind,
    isNonSchoolDay,
    scopeKind = CalendarEventScopeKind.School,
    scopeId,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    title: string
    startDate: Date
    endDate: Date
    kind: CalendarEventKind
    isNonSchoolDay?: boolean
    scopeKind?: CalendarEventScopeKind
    scopeId?: string
    createdAt?: Date
  }): Promise<CalendarEvent> {
    await this.authorize('scheduling.manage', { schoolId, academicYearId })
    await requireSchool(this.repositories.schools, schoolId)
    const academicYear = await this.requireAcademicYear(academicYearId)
    if (academicYear.schoolId !== schoolId) {
      denyResourceAccess()
    }
    if (startDate.getTime() < academicYear.startDate.getTime() || endDate.getTime() > academicYear.endDate.getTime()) {
      throw new BusinessRuleViolationError('CALENDAR_EVENT_OUT_OF_YEAR', `Calendar event ${id} must fit within academic year ${academicYearId}`)
    }
    if (scopeKind === CalendarEventScopeKind.ClassGroup) {
      const classGroup = await this.requireClassGroup(scopeId ?? '')
      if (classGroup.schoolId !== schoolId || classGroup.academicYearId !== academicYearId) {
        denyResourceAccess()
      }
    }
    if (scopeKind === CalendarEventScopeKind.GradeLevel) {
      const gradeLevel = scopeId ? await this.repositories.gradeLevels.findById(scopeId) : undefined
      if (!gradeLevel || gradeLevel.schoolId !== schoolId) {
        denyResourceAccess()
      }
    }
    const event = new CalendarEvent({
      id,
      schoolId,
      academicYearId,
      title,
      startDate,
      endDate,
      kind,
      isNonSchoolDay,
      scopeKind,
      scopeId,
      createdAt,
    })
    await this.repositories.calendarEvents.save(event)
    return event
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

  async recordDailyAttendance({
    id,
    classGroupId,
    studentId,
    date,
    status,
    createdAt,
  }: {
    id: string
    classGroupId: string
    studentId: string
    date: Date
    status: AttendanceStatus
    createdAt?: Date
  }): Promise<AttendanceRecord> {
    const classGroup = await this.requireClassGroup(classGroupId)
    this.requireDailyAttendanceMode(classGroup)
    await this.authorize('attendance.record', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    await this.requireEnrollmentForClassGroup({ studentId, classGroupId: classGroup.id })
    const createdBy = resolveAuditActorId(this.actor)
    return this.atomicExecution.execute(async () => {
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

  async reviewAttendanceJustification({
    studentId,
    sessionId,
    decision,
    reason,
    notes,
    reviewedAt,
  }: {
    studentId: string
    sessionId: string
    decision: AttendanceJustificationStatus.Excused | AttendanceJustificationStatus.Rejected
    reason: string
    notes?: string
    reviewedAt?: Date
  }): Promise<AttendanceRecord> {
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('attendance.review_justification', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: session.classSubjectId,
      sessionId: session.id,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    const record = await this.repositories.attendance.findOne({ studentId, sessionId })
    if (!record) {
      denyResourceAccess()
    }
    if (record.status !== AttendanceStatus.Absent) {
      throw new BusinessRuleViolationError('JUSTIFICATION_ABSENCE_REQUIRED', 'Only an absent attendance record may receive a justification decision')
    }
    if (
      record.justificationStatus === AttendanceJustificationStatus.Excused
      || record.justificationStatus === AttendanceJustificationStatus.Rejected
    ) {
      throw new BusinessRuleViolationError('JUSTIFICATION_ALREADY_REVIEWED', 'Attendance justification has already been reviewed')
    }
    if (reason.trim().length === 0) {
      throw new BusinessRuleViolationError('JUSTIFICATION_REASON_REQUIRED', 'reason is required for an attendance justification decision')
    }
    const decisionTime = reviewedAt ?? new Date()
    const reviewedRecord = new AttendanceRecord({
      id: record.id,
      studentId: record.studentId,
      sessionId: record.sessionId,
      date: record.date,
      status: record.status,
      justificationStatus: decision,
      reason,
      notes,
      justifiedAt: decisionTime,
      justifiedByStaffId: resolveAuditActorId(this.actor),
      correctedAt: record.correctedAt,
      correctedByStaffId: record.correctedByStaffId,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: decisionTime,
    })
    await this.repositories.attendance.save(reviewedRecord)
    return reviewedRecord
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

  async recordClassDailyAttendance({
    classGroupId,
    date,
    attendanceByStudent,
    createdAt,
  }: {
    classGroupId: string
    date: Date
    attendanceByStudent: Record<string, AttendanceStatus>
    createdAt?: Date
  }): Promise<AttendanceRecord[]> {
    const classGroup = await this.requireClassGroup(classGroupId)
    this.requireDailyAttendanceMode(classGroup)
    await this.authorize('attendance.record', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
    })
    for (const studentId of Object.keys(attendanceByStudent)) {
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
      await this.requireEnrollmentForClassGroup({ studentId, classGroupId: classGroup.id })
    }
    const createdBy = resolveAuditActorId(this.actor)
    return this.atomicExecution.execute(async () => {
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
    let excusedAbsenceCount = 0
    let lateCount = 0
    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.Present:
          presentCount += 1
          break
        case AttendanceStatus.Absent:
          absenceCount += 1
          if (record.justificationStatus === AttendanceJustificationStatus.Excused) {
            excusedAbsenceCount += 1
          }
          break
        case AttendanceStatus.Late:
          lateCount += 1
          break
      }
    }
    return new AttendanceSummary({ presentCount, absenceCount, excusedAbsenceCount, lateCount })
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
    const existing = await this.repositories.attendance.findOne({ studentId, sessionId })
    const isCorrection = existing !== undefined && existing.status !== status
    if (
      isCorrection
      && (existing.justificationStatus === AttendanceJustificationStatus.Excused
        || existing.justificationStatus === AttendanceJustificationStatus.Rejected)
    ) {
      throw new BusinessRuleViolationError('CORRECT_REVIEWED_ATTENDANCE_BLOCKED', 'Reviewed attendance must not be corrected without a reopen workflow')
    }
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
    await this.repositories.attendance.save(record)
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
    const existing = await this.repositories.sessions.findById(sessionId)
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
    await this.repositories.sessions.save(session)
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

  private async requireAcademicYear(academicYearId: string): Promise<AcademicYear> {
    const academicYear = await this.repositories.academicYears.findById(academicYearId)
    if (!academicYear) {
      denyResourceAccess()
    }
    return academicYear
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
    const enrollments = await this.repositories.enrollments.list({
      studentId,
      classGroupId,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (enrollments.length === 0) {
      throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${studentId} does not have an active enrollment in classGroup ${classGroupId}`)
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
    action: 'scheduling.manage' | 'attendance.record' | 'attendance.review_justification' | 'attendance.read',
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
