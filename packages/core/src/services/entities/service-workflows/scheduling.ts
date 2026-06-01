import type { ClassGroup } from '../../../entities/school/class-group'
import type { BaseSchoolService } from '../base-school-service'
import { AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus } from '../../../entities/scheduling/attendance-record'
import { CalendarEventScopeKind } from '../../../entities/scheduling/calendar-event'
import { DayOfWeek } from '../../../entities/scheduling/schedule'
import { Session, SessionKind } from '../../../entities/scheduling/session'
import { AttendanceMode } from '../../../entities/school/class-group'
import { StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import { normalizeDate } from '../../../entities/utils'
import { denyResourceAccess, resolveAuditActorId } from '../../authorization'
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

export interface ReviewAttendanceJustificationInput {
  studentId: string
  sessionId: string
  decision: AttendanceJustificationStatus.Excused | AttendanceJustificationStatus.Rejected
  reason: string
  notes?: string
  reviewedAt?: Date
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

export class SchedulingServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async generateSessions({
    classGroupId,
    startDate,
    endDate,
  }: GenerateSessionsInput): Promise<Session[]> {
    const classGroup = await this.requireClassGroup(classGroupId)
    await this.authorizeSchedulingManage(classGroup)
    return this.base.atomicExecution.execute(async () => {
      const schedules = await this.base.repositories.schedules.list({ classGroupId })
      const calendarEvents = await this.base.repositories.calendarEvents.list({ academicYearId: classGroup.academicYearId })
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
            await this.base.sessions.save(session, { moduleChecked: true })
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
      createdBy: resolveAuditActorId(this.base.actor),
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
    const classGroup = await this.requireClassGroup(classGroupId)
    this.requireDailyAttendanceMode(classGroup)
    await this.authorizeAttendanceRecord({ classGroup, studentId })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    await this.requireEnrollmentForClassGroup({ studentId, classGroupId: classGroup.id })
    const createdBy = resolveAuditActorId(this.base.actor)
    return this.base.atomicExecution.execute(async () => {
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
  }: ReviewAttendanceJustificationInput): Promise<AttendanceRecord> {
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorizeAttendanceReview({
      classGroup,
      session,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    const record = await this.base.repositories.attendance.findOne({ studentId, sessionId })
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
      justifiedByStaffId: resolveAuditActorId(this.base.actor),
      correctedAt: record.correctedAt,
      correctedByStaffId: record.correctedByStaffId,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: decisionTime,
    })
    await this.base.attendance.save(reviewedRecord, { moduleChecked: true })
    return reviewedRecord
  }

  async recordSessionAttendance({
    sessionId,
    attendanceByStudent,
    createdAt,
  }: RecordSessionAttendanceInput): Promise<AttendanceRecord[]> {
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorizeAttendanceRecord({ classGroup, session })
    for (const studentId of Object.keys(attendanceByStudent)) {
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
    }
    const createdBy = resolveAuditActorId(this.base.actor)
    return this.base.atomicExecution.execute(async () => {
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
    const classGroup = await this.requireClassGroup(classGroupId)
    this.requireDailyAttendanceMode(classGroup)
    await this.authorizeAttendanceRecord({ classGroup })
    for (const studentId of Object.keys(attendanceByStudent)) {
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
      await this.requireEnrollmentForClassGroup({ studentId, classGroupId: classGroup.id })
    }
    const createdBy = resolveAuditActorId(this.base.actor)
    return this.base.atomicExecution.execute(async () => {
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
    const existing = await this.base.repositories.attendance.findOne({ studentId, sessionId })
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
    await this.base.attendance.save(record, { moduleChecked: true })
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
    const existing = await this.base.repositories.sessions.findById(sessionId)
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
    await this.base.sessions.save(session, { moduleChecked: true })
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
    const session = await this.base.repositories.sessions.findById(sessionId)
    if (!session) {
      denyResourceAccess()
    }
    const classGroup = await this.base.repositories.classGroups.findById(session.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.base.actor.schoolId) {
      denyResourceAccess()
    }
    return session
  }

  private async requireStudentInSchool(studentId: string, schoolId: string): Promise<void> {
    const student = await this.base.repositories.students.findById(studentId)
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
    const enrollments = await this.base.repositories.enrollments.list({
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
    if (classGroup.id) {
      await this.base.authorizationPolicy.checkClassGroupAccess(this.base.actor, [classGroup.id])
    }
    if (session) {
      await this.base.authorizationPolicy.checkSessionAccess(this.base.actor, [session.id])
    }
    if (studentId) {
      await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [studentId])
    }
  }

  private async authorizeSchedulingManage(classGroup: ClassGroup): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)
    await this.base.authorizationPolicy.checkClassGroupAccess(this.base.actor, [classGroup.id])
  }

  private async authorizeAttendanceReview({
    classGroup,
    session,
    studentId,
  }: {
    classGroup: ClassGroup
    session: Session
    studentId: string
  }): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)
    await this.base.authorizationPolicy.checkClassGroupAccess(this.base.actor, [classGroup.id])
    await this.base.authorizationPolicy.checkSessionAccess(this.base.actor, [session.id])
    await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [studentId])
  }
}
