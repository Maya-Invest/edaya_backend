import type { AttendanceAnchor, AttendanceStatus, CalendarEventInput, ClassGroup, ScheduleInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { SchedulingWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import { ActivitySession, Attendance, AttendanceJustificationStatus, AttendanceMode, AttendanceRecord, BusinessRuleViolationError, CalendarEvent, calendarEventBlocksTimetable, CalendarEventScopeKind, civilDateKey, LessonSession, normalizeDate, OccurrenceStatus, Schedule, ScheduleKind, StudentClassEnrollmentStatus } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { ATTENDANCE_RECORDED_EVENT_KEY, runWorkflowNotifications } from '../../capabilities/notifications'
import { materializeOccurrences } from '../../capabilities/scheduling/materialize-occurrences'
import { findAttendanceRecordByAnchor } from '../entities/config/scheduling/attendance-record'

import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'
import { assertNoSessionConflict } from './schedule-conflicts'

function nextUtcCalendarDate(date: Date): Date {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  return normalizeDate(nextDate)
}

export interface SaveScheduleInput {
  schedule: ScheduleInput
  materialize?: boolean
}

export interface MaterializeScheduleInput {
  scheduleId: string
}

export interface RecordAttendanceInput {
  id: string
  studentId: string
  lessonSessionId: string
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

export interface RecordLessonSessionAttendanceInput {
  lessonSessionId: string
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

export interface ReviewAttendanceJustificationInput {
  activitySessionId?: string
  assessmentId?: string
  notes?: string | null
  studentId: string
  attendanceId?: string
  lessonSessionId?: string
  decision?: AttendanceJustificationStatus
  reason?: string
}

export interface RequestAttendanceJustificationInput {
  studentId: string
  attendanceId: string
  reason: string
}

export interface CancelLessonSessionInput {
  lessonSessionId: string
}

export interface CancelActivitySessionInput {
  activitySessionId: string
}

export interface RescheduleOccurrenceInput {
  lessonSessionId?: string
  activitySessionId?: string
  startsAt: Date
  endsAt: Date
}

export class SchedulingServiceWorkflow extends BaseServiceWorkflow {
  private withAcademicState<T>(operation: () => Promise<T>): Promise<T> {
    return this.baseService.atomicExecution.execute(operation, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  private readonly repositories: SchedulingWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('scheduling', base.repositories)
  }

  async saveSchedule({ schedule: input, materialize = true }: SaveScheduleInput): Promise<Schedule> {
    return this.withAcademicState(async () => {
      const schedule = await this.createSchedule(input)
      if (materialize) {
        await this.materializeSchedule({ scheduleId: schedule.id })
      }
      return schedule
    })
  }

  async createSchedule(input: CreateScheduleInput): Promise<Schedule> {
    return this.withAcademicState(async () => {
      const classGroup = await this.requireClassGroup(input.classGroupId)
      const schedule = new Schedule({
        ...input,
        schoolId: input.schoolId ?? classGroup.schoolId,
      })
      await this.baseService.entities.schedules.save(schedule)
      return schedule
    })
  }

  async createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    return this.withAcademicState(async () => {
      const event = new CalendarEvent(input)
      await this.baseService.entities.calendarEvents.save(event)
      return event
    })
  }

  async materializeSchedule({ scheduleId }: MaterializeScheduleInput): Promise<Array<LessonSession | ActivitySession>> {
    return this.withAcademicState(async () => {
      const schedule = await this.requireSchedule(scheduleId)
      if (schedule.scheduleKind === ScheduleKind.Lesson) {
        return this.materializeLessonSchedule(schedule)
      }
      if (schedule.scheduleKind === ScheduleKind.Activity) {
        return this.materializeActivitySchedule(schedule)
      }
      throw new BusinessRuleViolationError('INVALID_SCHEDULE_KIND', `Schedule ${scheduleId} has unsupported kind ${schedule.scheduleKind}`)
    })
  }

  private async materializeLessonSchedule(schedule: Schedule): Promise<LessonSession[]> {
    const offering = schedule.classSubjectId ? await this.repositories.classSubjects.findById(schedule.classSubjectId) : undefined
    if (!offering?.isOffered)
      return []
    const classGroup = await this.requireClassGroup(schedule.classGroupId)
    await this.authorizeTimetableCreate(classGroup)
    const academicYear = await this.requireAcademicYear(classGroup.academicYearId, classGroup.schoolId)
    const school = await this.requireSchool(classGroup.schoolId)
    const displayLabel = await this.resolveLessonDisplayLabel(schedule)
    const nonSchoolDates = await this.buildNonSchoolDates(classGroup)
    return this.withAcademicState(() => materializeOccurrences({
      list: () => this.repositories.lessonSessions.list({ scheduleId: schedule.id }),
      save: entity => this.baseService.entities.lessonSessions.save(entity),
      create: occurrence => new LessonSession({ ...occurrence, schoolId: schedule.schoolId, classGroupId: classGroup.id, scheduleId: schedule.id, classSubjectId: schedule.classSubjectId!, status: OccurrenceStatus.Pending, isException: false }),
      update: (existing, occurrence) => existing.copyWith({ ...occurrence, classSubjectId: schedule.classSubjectId! }),
      assertNoConflict: occurrence => this.assertNoScheduleConflict({ ...occurrence, classGroupId: classGroup.id, excludeLessonSessionId: occurrence.id }),
    }, { schedule, academicYear, displayLabel, nonSchoolDates, enforceConflicts: school.enforceScheduleConflicts }))
  }

  private async materializeActivitySchedule(schedule: Schedule): Promise<ActivitySession[]> {
    const classGroup = await this.requireClassGroup(schedule.classGroupId)
    await this.authorizeTimetableCreate(classGroup)
    const academicYear = await this.requireAcademicYear(classGroup.academicYearId, classGroup.schoolId)
    const school = await this.requireSchool(classGroup.schoolId)
    const displayLabel = await this.resolveActivityDisplayLabel(schedule)
    const nonSchoolDates = await this.buildNonSchoolDates(classGroup)
    return this.withAcademicState(() => materializeOccurrences({
      list: () => this.repositories.activitySessions.list({ scheduleId: schedule.id }),
      save: entity => this.baseService.entities.activitySessions.save(entity),
      create: occurrence => new ActivitySession({ ...occurrence, schoolId: schedule.schoolId, classGroupId: classGroup.id, scheduleId: schedule.id, activityId: schedule.activityId!, status: OccurrenceStatus.Pending, isException: false }),
      update: (existing, occurrence) => existing.copyWith({ ...occurrence, activityId: schedule.activityId! }),
      assertNoConflict: occurrence => this.assertNoScheduleConflict({ ...occurrence, classGroupId: classGroup.id, excludeActivitySessionId: occurrence.id }),
    }, { schedule, academicYear, displayLabel, nonSchoolDates, enforceConflicts: school.enforceScheduleConflicts }))
  }

  async recordAttendance({
    id,
    studentId,
    lessonSessionId,
    status,
    createdAt,
  }: RecordAttendanceInput): Promise<AttendanceRecord> {
    if (this.baseService.actor.kind === 'teacher')
      throw new BusinessRuleViolationError('ATTENDANCE_CALL_COMMAND_REQUIRED', 'Save attendance as a draft and submit the completed call')
    return this.withAcademicState(async () => {
      const lessonSession = await this.requireLessonSession(lessonSessionId)
      const classGroup = await this.requireClassGroup(lessonSession.classGroupId)
      await this.authorizeAttendanceRecord({
        classGroup,
        lessonSession,
        studentId,
      })
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
      const record = await this.saveAttendanceRecord({
        id,
        studentId,
        anchor: { lessonSessionId },
        date: lessonSession.startsAt,
        status,
        createdBy: resolveAuditActorId(this.baseService.actor),
        createdAt,
      })
      await this.completeLessonSessionIfNeeded(lessonSession)
      await runWorkflowNotifications(this.baseService, ATTENDANCE_RECORDED_EVENT_KEY, {
        records: [record],
        schoolId: classGroup.schoolId,
      })
      return record
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
    if (this.baseService.actor.kind === 'teacher')
      throw new BusinessRuleViolationError('ATTENDANCE_CALL_COMMAND_REQUIRED', 'Save attendance as a draft and submit the completed call')
    return this.withAcademicState(async () => {
      const classGroup = await this.requireClassGroup(classGroupId)
      this.requireDailyAttendanceMode(classGroup)
      await this.authorizeAttendanceRecord({ classGroup, studentId })
      await this.requireStudentInSchool(studentId, classGroup.schoolId)
      await this.requireEnrollmentForClassGroup({ studentId, classGroupId: classGroup.id })
      const createdBy = resolveAuditActorId(this.baseService.actor)
      return this.withAcademicState(async () => {
        const attendance = await this.getOrCreateAttendance(classGroup, date, createdAt)
        const record = await this.saveAttendanceRecord({
          id,
          studentId,
          anchor: { attendanceId: attendance.id },
          date: attendance.startsAt,
          status,
          createdBy,
          createdAt,
        })
        await runWorkflowNotifications(this.baseService, ATTENDANCE_RECORDED_EVENT_KEY, {
          records: [record],
          schoolId: classGroup.schoolId,
        })
        return record
      })
    })
  }

  async recordLessonSessionAttendance({
    lessonSessionId,
    attendanceByStudent,
    createdAt,
  }: RecordLessonSessionAttendanceInput): Promise<AttendanceRecord[]> {
    if (this.baseService.actor.kind === 'teacher')
      throw new BusinessRuleViolationError('ATTENDANCE_CALL_COMMAND_REQUIRED', 'Save attendance as a draft and submit the completed call')
    return this.withAcademicState(async () => {
      const lessonSession = await this.requireLessonSession(lessonSessionId)
      const classGroup = await this.requireClassGroup(lessonSession.classGroupId)
      await this.authorizeAttendanceRecord({ classGroup, lessonSession })
      for (const studentId of Object.keys(attendanceByStudent)) {
        await this.requireStudentInSchool(studentId, classGroup.schoolId)
      }
      const createdBy = resolveAuditActorId(this.baseService.actor)
      return this.withAcademicState(async () => {
        const records: AttendanceRecord[] = []
        for (const [studentId, status] of Object.entries(attendanceByStudent)) {
          records.push(await this.saveAttendanceRecord({
            id: `${studentId}-${lessonSessionId}`,
            studentId,
            anchor: { lessonSessionId },
            date: lessonSession.startsAt,
            status,
            createdBy,
            createdAt,
          }))
        }
        await this.completeLessonSessionIfNeeded(lessonSession)
        await runWorkflowNotifications(this.baseService, ATTENDANCE_RECORDED_EVENT_KEY, {
          records,
          schoolId: classGroup.schoolId,
        })
        return records
      })
    })
  }

  async recordClassDailyAttendance({
    classGroupId,
    date,
    attendanceByStudent,
    createdAt,
  }: RecordClassDailyAttendanceInput): Promise<AttendanceRecord[]> {
    if (this.baseService.actor.kind === 'teacher')
      throw new BusinessRuleViolationError('ATTENDANCE_CALL_COMMAND_REQUIRED', 'Save attendance as a draft and submit the completed call')
    return this.withAcademicState(async () => {
      const classGroup = await this.requireClassGroup(classGroupId)
      this.requireDailyAttendanceMode(classGroup)
      await this.authorizeAttendanceRecord({ classGroup })
      for (const studentId of Object.keys(attendanceByStudent)) {
        await this.requireStudentInSchool(studentId, classGroup.schoolId)
        await this.requireEnrollmentForClassGroup({ studentId, classGroupId: classGroup.id })
      }
      const createdBy = resolveAuditActorId(this.baseService.actor)
      return this.withAcademicState(async () => {
        const attendance = await this.getOrCreateAttendance(classGroup, date, createdAt)
        const records: AttendanceRecord[] = []
        for (const [studentId, status] of Object.entries(attendanceByStudent)) {
          records.push(await this.saveAttendanceRecord({
            id: `${studentId}-${attendance.id}`,
            studentId,
            anchor: { attendanceId: attendance.id },
            date: attendance.startsAt,
            status,
            createdBy,
            createdAt,
          }))
        }
        await runWorkflowNotifications(this.baseService, ATTENDANCE_RECORDED_EVENT_KEY, {
          records,
          schoolId: classGroup.schoolId,
        })
        return records
      })
    })
  }

  async cancelLessonSession({ lessonSessionId }: CancelLessonSessionInput): Promise<LessonSession> {
    return this.withAcademicState(async () => {
      const lessonSession = await this.requireLessonSession(lessonSessionId)
      const classGroup = await this.requireClassGroup(lessonSession.classGroupId)
      await this.authorizeTimetableUpdate(classGroup)
      if (lessonSession.status === OccurrenceStatus.Completed) {
        throw new BusinessRuleViolationError(
          'OCCURRENCE_IMMUTABLE',
          `Lesson session ${lessonSession.id} is completed and cannot be cancelled`,
        )
      }
      if (lessonSession.status === OccurrenceStatus.Cancelled) {
        return lessonSession
      }
      const cancelled = lessonSession.copyWith({
        status: OccurrenceStatus.Cancelled,
        isException: true,
      })
      await this.baseService.entities.lessonSessions.save(cancelled)
      return cancelled
    })
  }

  async cancelActivitySession({ activitySessionId }: CancelActivitySessionInput): Promise<ActivitySession> {
    return this.withAcademicState(async () => {
      const activitySession = await this.requireActivitySession(activitySessionId)
      const classGroup = await this.requireClassGroup(activitySession.classGroupId)
      await this.authorizeTimetableUpdate(classGroup)
      if (activitySession.status === OccurrenceStatus.Completed) {
        throw new BusinessRuleViolationError(
          'OCCURRENCE_IMMUTABLE',
          `Activity session ${activitySession.id} is completed and cannot be cancelled`,
        )
      }
      if (activitySession.status === OccurrenceStatus.Cancelled) {
        return activitySession
      }
      const cancelled = activitySession.copyWith({
        status: OccurrenceStatus.Cancelled,
        isException: true,
      })
      await this.baseService.entities.activitySessions.save(cancelled)
      return cancelled
    })
  }

  async rescheduleOccurrence({
    lessonSessionId,
    activitySessionId,
    startsAt,
    endsAt,
  }: RescheduleOccurrenceInput): Promise<LessonSession | ActivitySession> {
    return this.withAcademicState(async () => {
      if (lessonSessionId && activitySessionId) {
        throw new BusinessRuleViolationError(
          'INVALID_OCCURRENCE_TARGET',
          'rescheduleOccurrence requires exactly one of lessonSessionId or activitySessionId',
        )
      }
      if (!lessonSessionId && !activitySessionId) {
        throw new BusinessRuleViolationError(
          'INVALID_OCCURRENCE_TARGET',
          'rescheduleOccurrence requires lessonSessionId or activitySessionId',
        )
      }

      if (lessonSessionId) {
        const lessonSession = await this.requireLessonSession(lessonSessionId)
        const classGroup = await this.requireClassGroup(lessonSession.classGroupId)
        await this.authorizeTimetableUpdate(classGroup)
        if (lessonSession.status !== OccurrenceStatus.Pending) {
          throw new BusinessRuleViolationError(
            'OCCURRENCE_IMMUTABLE',
            `Lesson session ${lessonSession.id} cannot be rescheduled while ${lessonSession.status}`,
          )
        }
        const school = await this.requireSchool(classGroup.schoolId)
        if (school.enforceScheduleConflicts) {
          await this.assertNoScheduleConflict({
            classGroupId: classGroup.id,
            startsAt,
            endsAt,
            excludeLessonSessionId: lessonSession.id,
          })
        }
        const rescheduled = lessonSession.copyWith({ startsAt, endsAt, isException: true })
        await this.baseService.entities.lessonSessions.save(rescheduled)
        return rescheduled
      }

      const activitySession = await this.requireActivitySession(activitySessionId!)
      const classGroup = await this.requireClassGroup(activitySession.classGroupId)
      await this.authorizeTimetableUpdate(classGroup)
      if (activitySession.status !== OccurrenceStatus.Pending) {
        throw new BusinessRuleViolationError(
          'OCCURRENCE_IMMUTABLE',
          `Activity session ${activitySession.id} cannot be rescheduled while ${activitySession.status}`,
        )
      }
      const school = await this.requireSchool(classGroup.schoolId)
      if (school.enforceScheduleConflicts) {
        await this.assertNoScheduleConflict({
          classGroupId: classGroup.id,
          startsAt,
          endsAt,
          excludeActivitySessionId: activitySession.id,
        })
      }
      const rescheduled = activitySession.copyWith({ startsAt, endsAt, isException: true })
      await this.baseService.entities.activitySessions.save(rescheduled)
      return rescheduled
    })
  }

  async reviewAttendanceJustification({
    studentId,
    attendanceId,
    lessonSessionId,
    activitySessionId,
    assessmentId,
    decision,
    reason,
    notes,
  }: ReviewAttendanceJustificationInput): Promise<AttendanceRecord> {
    return this.withAcademicState(async () => {
      const supplied = [attendanceId, lessonSessionId, activitySessionId, assessmentId].filter(Boolean)
      if (supplied.length !== 1)
        throw new BusinessRuleViolationError('ATTENDANCE_ANCHOR_REQUIRED', 'Select exactly one attendance occurrence')
      const anchor: AttendanceAnchor = { attendanceId, lessonSessionId, activitySessionId, assessmentId }
      const existing = await findAttendanceRecordByAnchor(this.repositories, studentId, anchor)
      if (!existing) {
        denyResourceAccess()
      }
      const record = existing.copyWith({
        justificationStatus: decision ?? AttendanceJustificationStatus.Excused,
        reason,
        notes: notes === undefined ? existing.notes : notes,
        updatedAt: new Date(),
        justifiedAt: new Date(),
        justifiedByStaffId: resolveAuditActorId(this.baseService.actor),
      })
      await this.baseService.entities.attendance.save(record)
      return record
    })
  }

  async requestAttendanceJustification({
    studentId,
    attendanceId,
    reason,
  }: RequestAttendanceJustificationInput): Promise<AttendanceRecord> {
    return this.withAcademicState(async () => {
      const existing = await this.repositories.attendance.findById(attendanceId)
      if (!existing || existing.studentId !== studentId) {
        denyResourceAccess()
      }
      const record = existing.copyWith({
        justificationStatus: AttendanceJustificationStatus.Pending,
        reason,
      })
      await this.baseService.entities.attendance.save(record)
      return record
    })
  }

  private async saveAttendanceRecord({
    id,
    studentId,
    anchor,
    date,
    status,
    createdBy,
    createdAt,
  }: {
    id: string
    studentId: string
    anchor: AttendanceAnchor
    date: Date
    status: AttendanceStatus
    createdBy?: string
    createdAt?: Date
  }): Promise<AttendanceRecord> {
    await this.requireStudent(studentId)
    const classGroupId = await this.resolveAttendanceAnchorClassGroupId(anchor)
    await this.requireEnrollmentForClassGroup({ studentId, classGroupId, at: date })
    const existing = await findAttendanceRecordByAnchor(this.repositories, studentId, anchor)
    const isCorrection = existing !== undefined && existing.status !== status
    const updatedAt = isCorrection ? (createdAt ?? new Date()) : existing?.updatedAt ?? createdAt
    const record = new AttendanceRecord({
      id: existing?.id ?? id,
      studentId,
      ...anchor,
      date,
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
    await this.baseService.entities.attendance.save(record)
    return record
  }

  private async resolveAttendanceAnchorClassGroupId(anchor: AttendanceAnchor): Promise<string> {
    if (anchor.attendanceId) {
      const attendance = await this.repositories.attendances.findById(anchor.attendanceId)
      if (!attendance) {
        denyResourceAccess()
      }
      return attendance.classGroupId
    }
    if (anchor.lessonSessionId) {
      const lessonSession = await this.requireLessonSession(anchor.lessonSessionId)
      return lessonSession.classGroupId
    }
    if (anchor.activitySessionId) {
      const activitySession = await this.requireActivitySession(anchor.activitySessionId)
      return activitySession.classGroupId
    }
    denyResourceAccess()
  }

  private async completeLessonSessionIfNeeded(lessonSession: LessonSession): Promise<void> {
    if (lessonSession.status !== OccurrenceStatus.Pending) {
      return
    }
    const updated = lessonSession.copyWith({ status: OccurrenceStatus.Completed })
    await this.baseService.entities.lessonSessions.save(updated)
  }

  private requireDailyAttendanceMode(classGroup: ClassGroup): void {
    if (classGroup.attendanceMode !== AttendanceMode.Daily) {
      throw new BusinessRuleViolationError('DAILY_ATTENDANCE_MODE_REQUIRED', `Class group ${classGroup.id} is not configured for daily attendance`)
    }
  }

  private async getOrCreateAttendance(
    classGroup: ClassGroup,
    date: Date,
    createdAt?: Date,
  ): Promise<Attendance> {
    const normalizedDate = normalizeDate(date)
    const attendanceId = this.buildAttendanceId(classGroup.id, normalizedDate)
    const existing = await this.repositories.attendances.findById(attendanceId)
    if (existing) {
      if (existing.classGroupId !== classGroup.id) {
        denyResourceAccess()
      }
      return existing
    }
    const endsAt = new Date(normalizedDate)
    endsAt.setUTCDate(endsAt.getUTCDate() + 1)
    const attendance = new Attendance({
      id: attendanceId,
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      startsAt: normalizedDate,
      endsAt,
      displayLabel: 'Daily attendance',
      createdAt,
    })
    await this.baseService.entities.attendances.save(attendance)
    return attendance
  }

  private buildAttendanceId(classGroupId: string, date: Date): string {
    return `${classGroupId}:${date.toISOString().slice(0, 10)}`
  }

  private async requireSchedule(scheduleId: string): Promise<Schedule> {
    const schedule = await this.repositories.schedules.findById(scheduleId)
    if (!schedule) {
      denyResourceAccess()
    }
    const classGroup = await this.repositories.classGroups.findById(schedule.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return schedule
  }

  private async requireAcademicYear(academicYearId: string, schoolId: string) {
    const academicYear = await this.repositories.academicYears.findById(academicYearId)
    if (!academicYear || academicYear.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return academicYear
  }

  private async requireSchool(schoolId: string) {
    const school = await this.repositories.schools.findById(schoolId)
    if (!school) {
      denyResourceAccess()
    }
    return school
  }

  private async resolveLessonDisplayLabel(schedule: Schedule): Promise<string> {
    if (!schedule.classSubjectId) {
      return schedule.title
    }
    const classSubject = await this.repositories.classSubjects.findById(schedule.classSubjectId)
    if (!classSubject) {
      return schedule.title
    }
    const subject = await this.repositories.subjects.findById(classSubject.subjectId)
    return subject?.name ?? schedule.title
  }

  private async resolveActivityDisplayLabel(schedule: Schedule): Promise<string> {
    if (!schedule.activityId) {
      return schedule.title
    }
    const activity = await this.repositories.activities.findById(schedule.activityId)
    return activity?.name ?? schedule.title
  }

  private async buildNonSchoolDates(classGroup: ClassGroup): Promise<Set<string>> {
    const calendarEvents = await this.repositories.calendarEvents.list({ academicYearId: classGroup.academicYearId })
    const nonSchoolDates = new Set<string>()

    for (const event of calendarEvents) {
      const appliesToClass = event.scopeKind === CalendarEventScopeKind.School
        || (event.scopeKind === CalendarEventScopeKind.ClassGroup && event.scopeId === classGroup.id)
        || (event.scopeKind === CalendarEventScopeKind.GradeLevel && event.scopeId === classGroup.gradeLevelId)
      if (calendarEventBlocksTimetable(event) && appliesToClass) {
        let current = normalizeDate(event.startDate)
        const eventEndDate = normalizeDate(event.endDate)
        while (current <= eventEndDate) {
          nonSchoolDates.add(civilDateKey(current))
          current = nextUtcCalendarDate(current)
        }
      }
    }

    return nonSchoolDates
  }

  private async assertNoScheduleConflict({
    classGroupId,
    startsAt,
    endsAt,
    excludeLessonSessionId,
    excludeActivitySessionId,
  }: {
    classGroupId: string
    startsAt: Date
    endsAt: Date
    excludeLessonSessionId?: string
    excludeActivitySessionId?: string
  }): Promise<void> {
    await assertNoSessionConflict(this.repositories, {
      classGroupId,
      startsAt,
      endsAt,
      excludeSessionId: excludeLessonSessionId,
      excludeActivitySessionId,
    })
  }

  private async requireActivitySession(activitySessionId: string): Promise<ActivitySession> {
    const activitySession = await this.repositories.activitySessions.findById(activitySessionId)
    if (!activitySession) {
      denyResourceAccess()
    }
    if (activitySession.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return activitySession
  }

  private async requireLessonSession(lessonSessionId: string): Promise<LessonSession> {
    const lessonSession = await this.repositories.lessonSessions.findById(lessonSessionId)
    if (!lessonSession) {
      denyResourceAccess()
    }
    if (lessonSession.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return lessonSession
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
    at,
  }: {
    studentId: string
    classGroupId: string
    at?: Date
  }): Promise<void> {
    const enrollments = await this.repositories.enrollments.list({
      studentId,
      classGroupId,
      ...(at ? {} : { status: StudentClassEnrollmentStatus.Active }),
    })
    if (!enrollments.some(row => !at || (row.enrolledAt <= at && (!row.endedAt || at < row.endedAt)))) {
      throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${studentId} does not have an active enrollment in classGroup ${classGroupId}`)
    }
  }

  private async authorizeAttendanceRecord({
    classGroup,
    lessonSession,
    studentId,
  }: {
    classGroup: ClassGroup
    lessonSession?: LessonSession
    studentId?: string
  }): Promise<void> {
    await this.baseService.access.attendance.assertRecord({ classGroupId: classGroup.id, lessonSessionId: lessonSession?.id, studentId })
  }

  private async authorizeTimetableUpdate(classGroup: ClassGroup): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)

    await this.baseService.access.timetable.assertUpdateClass(classGroup.id)
  }

  private async authorizeTimetableCreate(classGroup: ClassGroup): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)

    await this.baseService.access.timetable.assertCreateClass(classGroup.id)
  }
}
