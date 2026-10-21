import { AcademicPeriod, ActivitySession, Assessment, AssessmentKind, AttendanceJustificationStatus, AttendanceMode, AttendanceRecord, AttendanceStatus, BusinessRuleViolationError, CalendarEventKind, CalendarEventScopeKind, DayOfWeek, LessonSession, MessageDeliveryRecipientKind, OccurrenceStatus, RecordingNotificationGateway, ScheduleKind } from '@edaya/core'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import { ATTENDANCE_RECORDED_EVENT_KEY } from '../../../src/capabilities/notifications'
import {
  createSchedulingContext,
} from './scheduling-workflow-context'

describe('SchoolService scheduling workflows', () => {
  test('materializeSchedule upserts lesson sessions for a single schedule', async () => {
    const { lessonSessions, service } = await createSchedulingContext({
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
    expect(Boolean(await lessonSessions.findById('sched-thu:2026-05-28'))).toBe(true)
    expect(result.find(session => session.id === 'sched-thu:2026-05-28')?.displayLabel).toBe('Math')
  })

  test('materializeSchedule upserts activity sessions for an activity schedule', async () => {
    const { activitySessions, service } = await createSchedulingContext({
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
    expect(Boolean(await activitySessions.findById('sched-chess:2026-05-28'))).toBe(true)
    expect(result.find(session => session.id === 'sched-chess:2026-05-28')?.displayLabel).toBe('Chess Club')
  })

  test('materializeSchedule skips non-school days that apply to the class', async () => {
    const { lessonSessions, service } = await createSchedulingContext({
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

    expect(Boolean(await lessonSessions.findById('sched-thu:2026-05-28'))).toBe(true)
    expect(Boolean(await lessonSessions.findById('sched-fri:2026-05-29'))).toBe(false)
  })

  test('materializeSchedule completes across a full academic year including DST spring-forward', async () => {
    const { lessonSessions, service } = await createSchedulingContext({
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
    expect(Boolean(await lessonSessions.findById('sched-mon:2026-03-09'))).toBe(true)
    expect(Boolean(await lessonSessions.findById('sched-mon:2026-03-16'))).toBe(true)
  })

  test('recordDailyAttendance creates a daily attendance occurrence and record through managed services', async () => {
    const { repositories, attendances, service } = await createSchedulingContext()

    const result = await service.schedulingWorkflow.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })

    expect(result.id).toBe('att1')
    expect(result.attendanceId).toBe('cg_daily:2026-05-28')
    expect(Boolean(await attendances.findById('cg_daily:2026-05-28'))).toBe(true)
    expect(await repositories.attendances.findById('cg_daily:2026-05-28')).toMatchObject({ id: 'cg_daily:2026-05-28',
    })
    expect((await repositories.attendance.findById(result.id))?.data).toEqual(result.data)
  })

  test('recordDailyAttendance reuses an existing daily attendance occurrence', async () => {
    const { repositories, service } = await createSchedulingContext({ existingDailyAttendance: true })

    const result = await service.schedulingWorkflow.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })

    expect(result.attendanceId).toBe('cg_daily:2026-05-28')
    expect(await repositories.attendances.count()).toBe(1)
    expect((await repositories.attendance.findById(result.id))?.data).toEqual(result.data)
  })

  test('recordDailyAttendance rejects non-daily class groups', async () => {
    const { service } = await createSchedulingContext({ classGroupAttendanceMode: AttendanceMode.Session })

    await expect(service.schedulingWorkflow.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordAttendance rejects correcting reviewed attendance', async () => {
    const { service } = await createSchedulingContext({
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
    const { service } = await createSchedulingContext({ notificationGateway: gateway })

    await service.schedulingWorkflow.recordAttendance({
      id: 'stu1-ses1',
      studentId: 'stu1',
      lessonSessionId: 'ses1',
      status: AttendanceStatus.Absent,
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      schoolId: 'sch1',
      kind: 'event',
      eventKey: ATTENDANCE_RECORDED_EVENT_KEY,
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: 'gua1' }],
    })
  })

  test('recordDailyAttendance enqueues guardian notifications for absent or late statuses', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = await createSchedulingContext({ notificationGateway: gateway })

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
    const { service } = await createSchedulingContext({ notificationGateway: gateway })

    await service.schedulingWorkflow.recordLessonSessionAttendance({
      lessonSessionId: 'ses1',
      attendanceByStudent: { stu1: AttendanceStatus.Absent },
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      schoolId: 'sch1',
      kind: 'event',
      eventKey: ATTENDANCE_RECORDED_EVENT_KEY,
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: 'gua1' }],
    })
  })

  test('recordLessonSessionAttendance records each student through managed attendance', async () => {
    const { repositories, service } = await createSchedulingContext()

    const result = await service.schedulingWorkflow.recordLessonSessionAttendance({
      lessonSessionId: 'ses1',
      attendanceByStudent: { stu1: AttendanceStatus.Late },
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('stu1-ses1')
    expect(result[0]?.status).toBe(AttendanceStatus.Late)
    expect((await repositories.attendance.findById(result[0]!.id))?.data).toEqual(result[0]?.data)
  })

  test('cancelLessonSession marks a pending lesson session as cancelled', async () => {
    const { repositories, service } = await createSchedulingContext()

    const result = await service.schedulingWorkflow.cancelLessonSession({ lessonSessionId: 'ses1' })

    expect(result.status).toBe(OccurrenceStatus.Cancelled)
    expect(result.isException).toBe(true)
    expect(await repositories.lessonSessions.findById('ses1')).toMatchObject({ id: 'ses1', status: OccurrenceStatus.Cancelled, isException: true })
  })

  test('rescheduleOccurrence updates lesson session times and marks exception', async () => {
    const { repositories, service } = await createSchedulingContext()
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
    expect(await repositories.lessonSessions.findById('ses1')).toMatchObject({ id: 'ses1', startsAt, endsAt, isException: true })
  })

  test('recordClassDailyAttendance records class attendance through a daily occurrence', async () => {
    const { repositories, service } = await createSchedulingContext()

    const result = await service.schedulingWorkflow.recordClassDailyAttendance({
      classGroupId: 'cg_daily',
      date: new Date('2026-05-28T12:00:00Z'),
      attendanceByStudent: { stu1: AttendanceStatus.Absent },
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('stu1-cg_daily:2026-05-28')
    expect(result[0]?.status).toBe(AttendanceStatus.Absent)
    expect(await repositories.attendances.findById('cg_daily:2026-05-28')).toMatchObject({ id: 'cg_daily:2026-05-28',
    })
    expect((await repositories.attendance.findById(result[0]!.id))?.data).toEqual(result[0]?.data)
  })

  test('saveSchedule creates a schedule and materializes occurrences', async () => {
    const schedules: any[] = []
    const { lessonSessions, service } = await createSchedulingContext({ schedules })

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
    expect(Boolean(await lessonSessions.findById('sched-save:2026-05-28'))).toBe(true)
  })

  test('createCalendarEvent persists calendar entries', async () => {
    const calendarEvents: any[] = []
    const { repositories, service } = await createSchedulingContext({ calendarEvents })

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
    expect(await repositories.calendarEvents.count()).toBe(1)
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
    const { lessonSessions, service } = await createSchedulingContext({
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
    expect((await lessonSessions.findById('sched-thu:2026-05-28'))?.displayLabel).toBe('Math')
    expect((await lessonSessions.findById('sched-thu:2026-05-28'))?.startsAt.toISOString()).toBe('2026-05-28T08:00:00.000Z')
  })

  test('materializeSchedule rejects overlapping occurrences when conflict enforcement is enabled', async () => {
    const { service } = await createSchedulingContext({
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
    const { activitySessions, service } = await createSchedulingContext({
      extraActivitySessions: { 'act-ses1': activitySession },
    })

    const cancelled = await service.schedulingWorkflow.cancelActivitySession({
      activitySessionId: 'act-ses1',
    })
    expect(cancelled.status).toBe(OccurrenceStatus.Cancelled)

    await activitySessions.save(new ActivitySession({
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
    const { lessonSessions, service } = await createSchedulingContext()
    await lessonSessions.save(new LessonSession({
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
    const { service } = await createSchedulingContext()

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
    const { service } = await createSchedulingContext({ existingAttendance: attendance })

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
    const { service } = await createSchedulingContext({ activeEnrollment: false })

    await expect(service.schedulingWorkflow.recordClassDailyAttendance({
      classGroupId: 'cg_daily',
      date: new Date('2026-05-28T12:00:00.000Z'),
      attendanceByStudent: { stu1: AttendanceStatus.Present },
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('saveSchedule rejects unsupported schedule kinds before persistence', async () => {
    const { repositories, service } = await createSchedulingContext()
    await expect(service.schedulingWorkflow.saveSchedule({ schedule: { id: 'invalid', schoolId: 'sch1', classGroupId: 'cg_daily', scheduleKind: 'unsupported', title: 'Invalid', isRecurring: true, dayOfWeek: DayOfWeek.Thursday, startTime: '08:00', endTime: '09:00' } as never })).rejects.toThrow()
    expect(await repositories.schedules.findById('invalid')).toBeUndefined()
  })
  test('reviews all occurrence anchors, retains notes on omission, clears null and uses server audit time', async () => {
    const { service, repositories } = await createSchedulingContext({ existingDailyAttendance: true })
    await repositories.activitySessions.save(new ActivitySession({ id: 'activity-review', scheduleId: 'sched-chess', schoolId: 'sch1', classGroupId: 'cg_daily', activityId: 'act1', displayLabel: 'Activity', startsAt: new Date('2026-05-28T15:00:00Z'), endsAt: new Date('2026-05-28T16:00:00Z') }))
    await repositories.academicPeriods.save(new AcademicPeriod({ id: 'review-period', schoolId: 'sch1', academicYearId: 'ay1', name: 'Term', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }))
    await repositories.assessments.save(new Assessment({ id: 'assessment-review', classGroupId: 'cg_daily', classSubjectId: 'cs1', periodId: 'review-period', title: 'Assessment', kind: AssessmentKind.Quiz, maxScore: 20, startsAt: new Date('2026-05-28T10:00:00Z'), endsAt: new Date('2026-05-28T11:00:00Z') }))
    for (const [index, anchor] of [{ attendanceId: 'cg_daily:2026-05-28' }, { lessonSessionId: 'ses1' }, { activitySessionId: 'activity-review' }, { assessmentId: 'assessment-review' }].entries()) {
      const id = Object.values(anchor)[0]!
      await repositories.attendance.save(new AttendanceRecord({ id: `review-${id}`, studentId: 'stu1', ...anchor, date: new Date('2026-05-28'), status: AttendanceStatus.Absent, notes: 'Retained note' }))
      const reviewed = await service.schedulingWorkflow.reviewAttendanceJustification({ studentId: 'stu1', ...anchor, decision: AttendanceJustificationStatus.Excused, reason: 'Reviewed reason', ...(index % 2 ? { notes: null } : {}), ...{ reviewedAt: new Date('1900-01-01') } })
      expect(reviewed.notes).toBe(index % 2 ? undefined : 'Retained note')
      expect(reviewed.justifiedByStaffId).toBe('user1')
      expect(reviewed.justifiedAt!.getFullYear()).toBeGreaterThan(1900)
    }
    await expect(service.schedulingWorkflow.reviewAttendanceJustification({ studentId: 'stu1', lessonSessionId: 'ses1', activitySessionId: 'activity-review', reason: 'Ambiguous' })).rejects.toMatchObject({ code: 'ATTENDANCE_ANCHOR_REQUIRED' })
  })
})
