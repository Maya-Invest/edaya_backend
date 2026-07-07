import {
  describe,
  expect,
  test,
} from 'bun:test'
import { RecordingNotificationGateway } from '../../../src/adapters'
import { ATTENDANCE_RECORDED_EVENT_KEY } from '../../../src/capabilities/notifications'
import {
  ActivitySession,
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceRecord,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  DayOfWeek,
  LessonSession,
  MessageDeliveryRecipientKind,
  OccurrenceStatus,
  ScheduleKind,
} from '../../../src/domain'
import { BusinessRuleViolationError } from '../../../src/domain/shared/business-rule-error'
import {
  actor,
  createSchedulingContext,
} from './workflow-test-context'

describe('SchoolService scheduling workflows', () => {
  test('materializeSchedule upserts lesson sessions for a single schedule', async () => {
    const { savedLessonSessions, service } = createSchedulingContext({
      schedules: [
        {
          id: 'sched-thu',
          schoolId: 'sch1',
          classGroupId: 'cg_daily',
          scheduleKind: ScheduleKind.Lesson,
          title: 'Math',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Thursday,
          startTime: '08:00',
          endTime: '09:00',
          classSubjectId: 'cs1',
        },
      ],
    })

    const result = await service.schedulingWorkflow.materializeSchedule({ scheduleId: 'sched-thu' })

    expect(result.length).toBeGreaterThan(0)
    expect(savedLessonSessions.has('sched-thu:2026-05-28')).toBe(true)
    expect(result.find(session => session.id === 'sched-thu:2026-05-28')?.displayLabel).toBe('Math')
  })

  test('materializeSchedule upserts activity sessions for an activity schedule', async () => {
    const { savedActivitySessions, service } = createSchedulingContext({
      schedules: [
        {
          id: 'sched-chess',
          schoolId: 'sch1',
          classGroupId: 'cg_daily',
          scheduleKind: ScheduleKind.Activity,
          title: 'Chess',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Thursday,
          startTime: '15:00',
          endTime: '16:00',
          activityId: 'act1',
        },
      ],
    })

    const result = await service.schedulingWorkflow.materializeSchedule({ scheduleId: 'sched-chess' })

    expect(result.length).toBeGreaterThan(0)
    expect(savedActivitySessions.has('sched-chess:2026-05-28')).toBe(true)
    expect(result.find(session => session.id === 'sched-chess:2026-05-28')?.displayLabel).toBe('Chess Club')
  })

  test('materializeSchedule skips non-school days that apply to the class', async () => {
    const { savedLessonSessions, service } = createSchedulingContext({
      schedules: [
        {
          id: 'sched-thu',
          schoolId: 'sch1',
          classGroupId: 'cg_daily',
          scheduleKind: ScheduleKind.Lesson,
          title: 'Math',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Thursday,
          startTime: '08:00',
          endTime: '09:00',
          classSubjectId: 'cs1',
        },
        {
          id: 'sched-fri',
          schoolId: 'sch1',
          classGroupId: 'cg_daily',
          scheduleKind: ScheduleKind.Lesson,
          title: 'History',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Friday,
          startTime: '09:00',
          endTime: '10:00',
          classSubjectId: 'cs3',
        },
      ],
      calendarEvents: [
        {
          id: 'holiday-grade',
          schoolId: 'sch1',
          academicYearId: 'ay1',
          title: 'Grade break',
          kind: CalendarEventKind.Break,
          isNonSchoolDay: true,
          scopeKind: CalendarEventScopeKind.GradeLevel,
          scopeId: 'grade1',
          startDate: new Date('2026-05-29T00:00:00Z'),
          endDate: new Date('2026-05-29T00:00:00Z'),
        },
      ],
    })

    await service.schedulingWorkflow.materializeSchedule({ scheduleId: 'sched-thu' })
    await service.schedulingWorkflow.materializeSchedule({ scheduleId: 'sched-fri' })

    expect(savedLessonSessions.has('sched-thu:2026-05-28')).toBe(true)
    expect(savedLessonSessions.has('sched-fri:2026-05-29')).toBe(false)
  })

  test('materializeSchedule completes across a full academic year including DST spring-forward', async () => {
    const { savedLessonSessions, service } = createSchedulingContext({
      schedules: [
        {
          id: 'sched-mon',
          schoolId: 'sch1',
          classGroupId: 'cg_daily',
          scheduleKind: ScheduleKind.Lesson,
          title: 'Math',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Monday,
          startTime: '08:00',
          endTime: '09:00',
          classSubjectId: 'cs1',
        },
      ],
      academicYear: {
        startDate: new Date('2025-09-01T00:00:00Z'),
        endDate: new Date('2026-07-03T00:00:00Z'),
      },
    })

    const result = await service.schedulingWorkflow.materializeSchedule({ scheduleId: 'sched-mon' })

    expect(result.length).toBeGreaterThan(40)
    expect(savedLessonSessions.has('sched-mon:2026-03-09')).toBe(true)
    expect(savedLessonSessions.has('sched-mon:2026-03-16')).toBe(true)
  })

  test('recordDailyAttendance creates a daily attendance occurrence and record through managed services', async () => {
    const { mockAtomic, mockPolicy, mockRepos, savedDailyAttendances, service } = createSchedulingContext()

    const result = await service.schedulingWorkflow.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })

    expect(result.id).toBe('att1')
    expect(result.attendanceId).toBe('cg_daily:2026-05-28')
    expect(savedDailyAttendances.has('cg_daily:2026-05-28')).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg_daily'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.attendances.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'cg_daily:2026-05-28',
    }))
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result)
  })

  test('recordDailyAttendance reuses an existing daily attendance occurrence', async () => {
    const { mockRepos, service } = createSchedulingContext({ existingDailyAttendance: true })

    const result = await service.schedulingWorkflow.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })

    expect(result.attendanceId).toBe('cg_daily:2026-05-28')
    expect(mockRepos.attendances.save).not.toHaveBeenCalled()
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result)
  })

  test('recordDailyAttendance rejects non-daily class groups', async () => {
    const { service } = createSchedulingContext({ classGroupAttendanceMode: AttendanceMode.Session })

    await expect(service.schedulingWorkflow.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordAttendance rejects correcting reviewed attendance', async () => {
    const { service } = createSchedulingContext({
      existingAttendance: new AttendanceRecord({
        id: 'stu1-ses1',
        studentId: 'stu1',
        lessonSessionId: 'ses1',
        date: new Date('2026-05-28T08:00:00Z'),
        status: AttendanceStatus.Absent,
        justificationStatus: AttendanceJustificationStatus.Excused,
        justifiedAt: new Date('2026-05-28T08:00:00Z'),
        justifiedByStaffId: 'staff1',
      }),
    })

    await expect(service.schedulingWorkflow.recordAttendance({
      id: 'stu1-ses1',
      studentId: 'stu1',
      lessonSessionId: 'ses1',
      status: AttendanceStatus.Present,
    })).rejects.toThrow('Reviewed attendance must not be corrected without a reopen workflow')
  })

  test('recordAttendance enqueues guardian notifications for absent or late statuses', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createSchedulingContext({ notificationGateway: gateway })

    await service.schedulingWorkflow.recordAttendance({
      id: 'stu1-ses1',
      studentId: 'stu1',
      lessonSessionId: 'ses1',
      status: AttendanceStatus.Absent,
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      idempotencyKey: `delivery:${ATTENDANCE_RECORDED_EVENT_KEY}:stu1:ses1:${AttendanceStatus.Absent}:subject:gua1`,
      schoolId: 'sch1',
      kind: 'event',
      eventKey: ATTENDANCE_RECORDED_EVENT_KEY,
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: 'gua1' }],
    })
  })

  test('recordDailyAttendance enqueues guardian notifications for absent or late statuses', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createSchedulingContext({ notificationGateway: gateway })

    await service.schedulingWorkflow.recordDailyAttendance({
      id: 'stu1-cg_daily:2026-05-28',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Late,
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]?.eventKey).toBe(ATTENDANCE_RECORDED_EVENT_KEY)
    expect(gateway.enqueued[0]?.recipients).toEqual([{ kind: MessageDeliveryRecipientKind.Guardian, id: 'gua1', subjectId: 'subject:gua1' }])
  })

  test('recordLessonSessionAttendance enqueues guardian notifications for absent or late statuses', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createSchedulingContext({ notificationGateway: gateway })

    await service.schedulingWorkflow.recordLessonSessionAttendance({
      lessonSessionId: 'ses1',
      attendanceByStudent: { stu1: AttendanceStatus.Absent },
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      idempotencyKey: `delivery:${ATTENDANCE_RECORDED_EVENT_KEY}:stu1:ses1:${AttendanceStatus.Absent}:subject:gua1`,
      schoolId: 'sch1',
      kind: 'event',
      eventKey: ATTENDANCE_RECORDED_EVENT_KEY,
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: 'gua1' }],
    })
  })

  test('recordLessonSessionAttendance records each student through managed attendance', async () => {
    const { mockRepos, service } = createSchedulingContext()

    const result = await service.schedulingWorkflow.recordLessonSessionAttendance({
      lessonSessionId: 'ses1',
      attendanceByStudent: { stu1: AttendanceStatus.Late },
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('stu1-ses1')
    expect(result[0]?.status).toBe(AttendanceStatus.Late)
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result[0])
  })

  test('cancelLessonSession marks a pending lesson session as cancelled', async () => {
    const { mockPolicy, mockRepos, service } = createSchedulingContext()

    const result = await service.schedulingWorkflow.cancelLessonSession({ lessonSessionId: 'ses1' })

    expect(result.status).toBe(OccurrenceStatus.Cancelled)
    expect(result.isException).toBe(true)
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg_daily'])
    expect(mockRepos.lessonSessions.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ses1',
      status: OccurrenceStatus.Cancelled,
      isException: true,
    }))
  })

  test('rescheduleOccurrence updates lesson session times and marks exception', async () => {
    const { mockRepos, service } = createSchedulingContext()
    const startsAt = new Date('2026-05-29T10:00:00Z')
    const endsAt = new Date('2026-05-29T11:00:00Z')

    const result = await service.schedulingWorkflow.rescheduleOccurrence({
      lessonSessionId: 'ses1',
      startsAt,
      endsAt,
    })

    expect(result.startsAt).toEqual(startsAt)
    expect(result.endsAt).toEqual(endsAt)
    expect(result.isException).toBe(true)
    expect(mockRepos.lessonSessions.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ses1',
      startsAt,
      endsAt,
      isException: true,
    }))
  })

  test('recordClassDailyAttendance records class attendance through a daily occurrence', async () => {
    const { mockRepos, service } = createSchedulingContext()

    const result = await service.schedulingWorkflow.recordClassDailyAttendance({
      classGroupId: 'cg_daily',
      date: new Date('2026-05-28T12:00:00Z'),
      attendanceByStudent: { stu1: AttendanceStatus.Absent },
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('stu1-cg_daily:2026-05-28')
    expect(result[0]?.status).toBe(AttendanceStatus.Absent)
    expect(mockRepos.attendances.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'cg_daily:2026-05-28',
    }))
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result[0])
  })

  test('saveSchedule creates a schedule and materializes occurrences', async () => {
    const schedules: any[] = []
    const { savedLessonSessions, service } = createSchedulingContext({ schedules })

    const schedule = await service.schedulingWorkflow.saveSchedule({
      schedule: {
        id: 'sched-save',
        schoolId: 'sch1',
        classGroupId: 'cg_daily',
        scheduleKind: ScheduleKind.Lesson,
        title: 'Science',
        isRecurring: true,
        dayOfWeek: DayOfWeek.Thursday,
        startTime: '10:00',
        endTime: '11:00',
        classSubjectId: 'cs2',
      },
    })

    expect(schedule.id).toBe('sched-save')
    expect(savedLessonSessions.has('sched-save:2026-05-28')).toBe(true)
  })

  test('createCalendarEvent persists calendar entries', async () => {
    const calendarEvents: any[] = []
    const { service } = createSchedulingContext({ calendarEvents })

    const event = await service.schedulingWorkflow.createCalendarEvent({
      id: 'event-1',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      title: 'Sports day',
      kind: CalendarEventKind.Event,
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-06-01T00:00:00Z'),
    })

    expect(event.id).toBe('event-1')
    expect(calendarEvents).toHaveLength(1)
  })

  test('materializeSchedule resyncs pending non-exception lesson sessions', async () => {
    const existing = new LessonSession({
      id: 'sched-thu:2026-05-28',
      schoolId: 'sch1',
      classGroupId: 'cg_daily',
      scheduleId: 'sched-thu',
      classSubjectId: 'cs1',
      displayLabel: 'Old label',
      status: OccurrenceStatus.Pending,
      isException: false,
      startsAt: new Date('2026-05-28T07:00:00.000Z'),
      endsAt: new Date('2026-05-28T08:00:00.000Z'),
    })
    const { savedLessonSessions, service } = createSchedulingContext({
      extraLessonSessions: { 'sched-thu:2026-05-28': existing },
      schedules: [{
        id: 'sched-thu',
        schoolId: 'sch1',
        classGroupId: 'cg_daily',
        scheduleKind: ScheduleKind.Lesson,
        title: 'Math',
        isRecurring: true,
        dayOfWeek: DayOfWeek.Thursday,
        startTime: '08:00',
        endTime: '09:00',
        classSubjectId: 'cs1',
      }],
      academicYear: {
        startDate: new Date('2026-05-28T00:00:00Z'),
        endDate: new Date('2026-05-28T23:59:59Z'),
      },
    })

    const result = await service.schedulingWorkflow.materializeSchedule({ scheduleId: 'sched-thu' })

    expect(result).toHaveLength(1)
    expect(savedLessonSessions.get('sched-thu:2026-05-28')?.displayLabel).toBe('Math')
    expect(savedLessonSessions.get('sched-thu:2026-05-28')?.startsAt.toISOString()).toBe('2026-05-28T08:00:00.000Z')
  })

  test('materializeSchedule rejects overlapping occurrences when conflict enforcement is enabled', async () => {
    const { service } = createSchedulingContext({
      enforceScheduleConflicts: true,
      extraLessonSessions: {
        'blocking-session': new LessonSession({
          id: 'blocking-session',
          schoolId: 'sch1',
          classGroupId: 'cg_daily',
          scheduleId: 'sched-other',
          classSubjectId: 'cs2',
          displayLabel: 'Science',
          status: OccurrenceStatus.Pending,
          isException: false,
          startsAt: new Date('2026-05-28T08:30:00.000Z'),
          endsAt: new Date('2026-05-28T09:30:00.000Z'),
        }),
      },
      schedules: [{
        id: 'sched-thu',
        schoolId: 'sch1',
        classGroupId: 'cg_daily',
        scheduleKind: ScheduleKind.Lesson,
        title: 'Math',
        isRecurring: true,
        dayOfWeek: DayOfWeek.Thursday,
        startTime: '08:00',
        endTime: '09:00',
        classSubjectId: 'cs1',
      }],
      academicYear: {
        startDate: new Date('2026-05-28T00:00:00Z'),
        endDate: new Date('2026-05-28T23:59:59Z'),
      },
    })

    await expect(service.schedulingWorkflow.materializeSchedule({ scheduleId: 'sched-thu' }))
      .rejects
      .toBeInstanceOf(BusinessRuleViolationError)
  })

  test('cancelActivitySession and rescheduleOccurrence manage activity sessions', async () => {
    const activitySession = new ActivitySession({
      id: 'act-ses1',
      schoolId: 'sch1',
      classGroupId: 'cg_daily',
      scheduleId: 'sched-chess',
      activityId: 'act1',
      displayLabel: 'Chess Club',
      status: OccurrenceStatus.Pending,
      isException: false,
      startsAt: new Date('2026-05-28T15:00:00.000Z'),
      endsAt: new Date('2026-05-28T16:00:00.000Z'),
    })
    const { savedActivitySessions, service } = createSchedulingContext({
      extraActivitySessions: { 'act-ses1': activitySession },
    })

    const cancelled = await service.schedulingWorkflow.cancelActivitySession({
      activitySessionId: 'act-ses1',
    })
    expect(cancelled.status).toBe(OccurrenceStatus.Cancelled)

    savedActivitySessions.set('act-ses2', new ActivitySession({
      id: 'act-ses2',
      schoolId: 'sch1',
      classGroupId: 'cg_daily',
      scheduleId: 'sched-chess',
      activityId: 'act1',
      displayLabel: 'Chess Club',
      status: OccurrenceStatus.Pending,
      isException: false,
      startsAt: new Date('2026-05-29T15:00:00.000Z'),
      endsAt: new Date('2026-05-29T16:00:00.000Z'),
    }))

    const rescheduled = await service.schedulingWorkflow.rescheduleOccurrence({
      activitySessionId: 'act-ses2',
      startsAt: new Date('2026-05-29T16:00:00.000Z'),
      endsAt: new Date('2026-05-29T17:00:00.000Z'),
    })

    expect(rescheduled.startsAt.toISOString()).toBe('2026-05-29T16:00:00.000Z')
    expect(rescheduled.isException).toBe(true)
  })

  test('cancelLessonSession is idempotent for already cancelled sessions', async () => {
    const { savedLessonSessions, service } = createSchedulingContext()
    savedLessonSessions.set('ses1', new LessonSession({
      id: 'ses1',
      schoolId: 'sch1',
      classGroupId: 'cg_daily',
      scheduleId: 'sched-1',
      classSubjectId: 'cs1',
      displayLabel: 'Math',
      status: OccurrenceStatus.Cancelled,
      isException: true,
      startsAt: new Date('2026-05-28T08:00:00Z'),
      endsAt: new Date('2026-05-28T09:00:00Z'),
    }))

    const result = await service.schedulingWorkflow.cancelLessonSession({ lessonSessionId: 'ses1' })

    expect(result.status).toBe(OccurrenceStatus.Cancelled)
  })

  test('rescheduleOccurrence rejects ambiguous or missing occurrence targets', async () => {
    const { service } = createSchedulingContext()

    await expect(service.schedulingWorkflow.rescheduleOccurrence({
      startsAt: new Date('2026-05-29T10:00:00.000Z'),
      endsAt: new Date('2026-05-29T11:00:00.000Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(service.schedulingWorkflow.rescheduleOccurrence({
      lessonSessionId: 'ses1',
      activitySessionId: 'act-ses1',
      startsAt: new Date('2026-05-29T10:00:00.000Z'),
      endsAt: new Date('2026-05-29T11:00:00.000Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('requestAttendanceJustification and reviewAttendanceJustification update records', async () => {
    const attendance = new AttendanceRecord({
      id: 'stu1-ses1',
      studentId: 'stu1',
      lessonSessionId: 'ses1',
      date: new Date('2026-05-28T08:00:00Z'),
      status: AttendanceStatus.Absent,
    })
    const { service } = createSchedulingContext({ existingAttendance: attendance })

    const requested = await service.schedulingWorkflow.requestAttendanceJustification({
      studentId: 'stu1',
      attendanceId: 'stu1-ses1',
      reason: 'Medical appointment',
    })
    expect(requested.justificationStatus).toBe(AttendanceJustificationStatus.Pending)

    const reviewed = await service.schedulingWorkflow.reviewAttendanceJustification({
      studentId: 'stu1',
      lessonSessionId: 'ses1',
      decision: AttendanceJustificationStatus.Excused,
      reason: 'Approved',
    })
    expect(reviewed.justificationStatus).toBe(AttendanceJustificationStatus.Excused)
    expect(reviewed.justifiedByStaffId).toBe('user1')
  })

  test('recordClassDailyAttendance rejects students without active enrollments', async () => {
    const { service } = createSchedulingContext({ activeEnrollment: false })

    await expect(service.schedulingWorkflow.recordClassDailyAttendance({
      classGroupId: 'cg_daily',
      date: new Date('2026-05-28T12:00:00.000Z'),
      attendanceByStudent: { stu1: AttendanceStatus.Present },
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('materializeSchedule rejects unsupported schedule kinds', async () => {
    const schedules = [{
      id: 'sched-invalid',
      schoolId: 'sch1',
      classGroupId: 'cg_daily',
      scheduleKind: 'unsupported',
      title: 'Invalid',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Thursday,
      startTime: '08:00',
      endTime: '09:00',
    }]
    const { service } = createSchedulingContext({ schedules })

    await expect(service.schedulingWorkflow.materializeSchedule({ scheduleId: 'sched-invalid' }))
      .rejects
      .toBeInstanceOf(BusinessRuleViolationError)
  })
})
