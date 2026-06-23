import {
  describe,
  expect,
  test,
} from 'bun:test'
import {
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceRecord,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  DayOfWeek,
} from '../../../src/domains'
import { BusinessRuleViolationError } from '../../../src/shared/business-rule-error'
import {
  actor,
  createSchedulingContext,
} from './workflow-test-context'

describe('SchoolService scheduling workflows', () => {
  test('generateSessions expands schedules and saves sessions through managed service', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createSchedulingContext({
      schedules: [
        {
          id: 'sched-thu',
          classGroupId: 'cg_daily',
          title: 'Math',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Thursday,
          startTime: '08:00',
          endTime: '09:00',
          classSubjectId: 'cs1',
        },
        {
          id: 'sched-specific',
          classGroupId: 'cg_daily',
          title: 'Science lab',
          isRecurring: false,
          specificDate: new Date('2026-05-29T00:00:00Z'),
          startTime: '10:00',
          endTime: '11:30',
        },
      ],
    })

    const result = await service.schedulingWorkflow.generateSessions({
      classGroupId: 'cg_daily',
      startDate: new Date('2026-05-28T00:00:00Z'),
      endDate: new Date('2026-05-29T00:00:00Z'),
    })

    expect(result).toHaveLength(2)
    expect(result.map(session => session.title)).toEqual(['Math', 'Science lab'])
    expect(result[0]?.scheduleId).toBe('sched-thu')
    expect(result[0]?.startsAt.getHours()).toBe(8)
    expect(result[1]?.scheduleId).toBe('sched-specific')
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg_daily'])
    expect(mockRepos.sessions.save).toHaveBeenCalledTimes(2)
    expect(mockRepos.sessions.save).toHaveBeenCalledWith(result[0])
    expect(mockRepos.sessions.save).toHaveBeenCalledWith(result[1])
  })

  test('generateSessions skips non-school days that apply to the class', async () => {
    const { mockRepos, service } = createSchedulingContext({
      schedules: [
        {
          id: 'sched-thu',
          classGroupId: 'cg_daily',
          title: 'Math',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Thursday,
          startTime: '08:00',
          endTime: '09:00',
        },
        {
          id: 'sched-fri',
          classGroupId: 'cg_daily',
          title: 'History',
          isRecurring: true,
          dayOfWeek: DayOfWeek.Friday,
          startTime: '09:00',
          endTime: '10:00',
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

    const result = await service.schedulingWorkflow.generateSessions({
      classGroupId: 'cg_daily',
      startDate: new Date('2026-05-28T00:00:00Z'),
      endDate: new Date('2026-05-29T00:00:00Z'),
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('Math')
    expect(mockRepos.sessions.save).toHaveBeenCalledTimes(1)
  })

  test('recordDailyAttendance creates a daily session and attendance through managed services', async () => {
    const { mockAtomic, mockPolicy, mockRepos, savedSessions, service } = createSchedulingContext()

    const result = await service.schedulingWorkflow.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })

    expect(result.id).toBe('att1')
    expect(result.sessionId).toBe('daily:cg_daily:2026-05-28')
    expect(savedSessions.has('daily:cg_daily:2026-05-28')).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg_daily'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkAttendanceAccess).toHaveBeenCalledWith(actor, ['stu1'], ['daily:cg_daily:2026-05-28'])
    expect(mockRepos.sessions.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'daily:cg_daily:2026-05-28',
    }))
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result)
  })

  test('recordDailyAttendance reuses an existing daily session', async () => {
    const { mockRepos, service } = createSchedulingContext({ existingDailySession: true })

    const result = await service.schedulingWorkflow.recordDailyAttendance({
      id: 'att1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T12:00:00Z'),
      status: AttendanceStatus.Present,
    })

    expect(result.sessionId).toBe('daily:cg_daily:2026-05-28')
    expect(mockRepos.sessions.save).not.toHaveBeenCalled()
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
        sessionId: 'ses1',
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
      sessionId: 'ses1',
      status: AttendanceStatus.Present,
    })).rejects.toThrow('Reviewed attendance must not be corrected without a reopen workflow')
  })

  test('recordSessionAttendance records each student through managed attendance', async () => {
    const { mockRepos, service } = createSchedulingContext()

    const result = await service.schedulingWorkflow.recordSessionAttendance({
      sessionId: 'ses1',
      attendanceByStudent: { stu1: AttendanceStatus.Late },
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('stu1-ses1')
    expect(result[0]?.status).toBe(AttendanceStatus.Late)
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result[0])
  })

  test('recordClassDailyAttendance records class attendance through a daily session', async () => {
    const { mockRepos, service } = createSchedulingContext()

    const result = await service.schedulingWorkflow.recordClassDailyAttendance({
      classGroupId: 'cg_daily',
      date: new Date('2026-05-28T12:00:00Z'),
      attendanceByStudent: { stu1: AttendanceStatus.Absent },
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('stu1-daily:cg_daily:2026-05-28')
    expect(result[0]?.status).toBe(AttendanceStatus.Absent)
    expect(mockRepos.sessions.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'daily:cg_daily:2026-05-28',
    }))
    expect(mockRepos.attendance.save).toHaveBeenCalledWith(result[0])
  })
})
