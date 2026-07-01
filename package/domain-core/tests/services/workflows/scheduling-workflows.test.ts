import {
  describe,
  expect,
  test,
} from 'bun:test'
import { RecordingNotificationGateway } from '../../../src/adapters'
import { ATTENDANCE_RECORDED_EVENT_KEY } from '../../../src/capabilities/notifications'
import {
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceRecord,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  DayOfWeek,
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
})
