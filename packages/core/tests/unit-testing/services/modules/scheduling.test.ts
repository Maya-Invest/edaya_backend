import type { ActorMetadata } from '../../../../src/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../../src/authorization/authorization-policy'
import type { AtomicExecutionPort } from '../../../../src/ports/atomic-execution'
import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import { describe, expect, mock, test } from 'bun:test'
import { AttendanceStatus } from '../../../../src/entities/scheduling/attendance-record'
import { SessionKind } from '../../../../src/entities/scheduling/session'
import { AttendanceMode } from '../../../../src/entities/school/class-group'
import { StudentClassEnrollmentStatus } from '../../../../src/entities/students/student-class-enrollment'
import { SchedulingService } from '../../../../src/legacy_services/commands/scheduling'

describe('SchedulingService', () => {
  const mockRepos = {
    periodDefinitions: { save: mock(async () => {}) },
    schools: { findById: mock(async () => ({ id: 'sch1' })) },
    academicYears: { findById: mock(async () => ({ id: 'ay1', schoolId: 'sch1' })) },
    classGroups: {
      findById: mock(async id => ({
        id,
        schoolId: 'sch1',
        attendanceMode: id.startsWith('cg_daily') ? AttendanceMode.Daily : AttendanceMode.Session,
      })),
    },
    students: { findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1' })) },
    enrollments: { list: mock(async () => [{ studentId: 'stu1', status: StudentClassEnrollmentStatus.Active }]) },
    sessions: {
      findById: mock(async (id) => {
        if (id.startsWith('daily:cg_daily')) {
          return { id, classGroupId: id.split(':')[1], kind: SessionKind.Other, title: 'Daily attendance', startsAt: new Date(id.split(':')[2]) }
        }
        if (id === 'ses1') {
          return { id, classGroupId: 'cg_daily', kind: SessionKind.Course, title: 'Math', startsAt: new Date('2026-05-28T08:00:00Z') }
        }
        return undefined
      }),
      save: mock(async () => {}),
    },
    attendance: {
      findOne: mock(async () => undefined),
      save: mock(async () => {}),
      list: mock(async () => [
        { id: 'ar1', studentId: 'stu1', sessionId: 'ses1', status: AttendanceStatus.Present },
        { id: 'ar2', studentId: 'stu1', sessionId: 'ses2', status: AttendanceStatus.Absent },
        { id: 'ar3', studentId: 'stu1', sessionId: 'ses3', status: AttendanceStatus.Late },
      ]),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = {
    requirePermission: mock(async () => {}),
    checkStudentAccess: mock(async () => {}),
    checkGuardianAccess: mock(async () => {}),
    checkStudentNoteAccess: mock(async () => {}),
    checkStudentHealthAccess: mock(async () => {}),
    checkClassGroupAccess: mock(async () => {}),
    checkAssessmentAccess: mock(async () => {}),
    checkReportCardResultAccess: mock(async () => {}),
    checkFeeAccess: mock(async () => {}),
    checkStudentFeeAccess: mock(async () => {}),
    checkSessionAccess: mock(async () => {}),
    checkAttendanceAccess: mock(async () => {}),
    checkGlobalAction: mock(async () => {}),
    checkModuleAccess: mock(async () => {}),
  } as unknown as AuthorizationPolicy
  const mockAtomic: AtomicExecutionPort = { execute: mock(async (op: () => Promise<any>) => op()) }
  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'sch1',
    requestId: 'req1',
    reason: 'test',
  }

  const service = new SchedulingService({ repositories: mockRepos, authorizationPolicy: mockPolicy, actor, atomicExecution: mockAtomic } as any)

  test('recordDailyAttendance creates session if missing', async () => {
    const res = await service.recordDailyAttendance({
      id: 'ar1',
      classGroupId: 'cg_daily',
      studentId: 'stu1',
      date: new Date('2026-05-28T00:00:00Z'),
      status: AttendanceStatus.Present,
    })
    expect(res.id).toBe('ar1')
  })

  test('recordDailyAttendance uses existing session', async () => {
    const res = await service.recordDailyAttendance({
      id: 'ar2',
      classGroupId: 'cg_daily_existing',
      studentId: 'stu1',
      date: new Date('2026-05-28T00:00:00Z'),
      status: AttendanceStatus.Present,
    })
    expect(res.id).toBe('ar2')
  })

  test('recordDailyAttendance throws if mode is not daily', async () => {
    expect(
      service.recordDailyAttendance({
        id: 'ar3',
        classGroupId: 'cg_subject',
        studentId: 'stu1',
        date: new Date(),
        status: AttendanceStatus.Present,
      }),
    ).rejects.toThrow('not configured for daily attendance')
  })

  test('recordClassDailyAttendance succeeds', async () => {
    const res = await service.recordClassDailyAttendance({
      classGroupId: 'cg_daily',
      date: new Date('2026-05-28T00:00:00Z'),
      attendanceByStudent: { stu1: AttendanceStatus.Present },
    })
    expect(res.length).toBe(1)
  })

  test('recordSessionAttendance succeeds', async () => {
    const res = await service.recordSessionAttendance({
      sessionId: 'ses1',
      attendanceByStudent: { stu1: AttendanceStatus.Present },
    })
    expect(res.length).toBe(1)
  })

  test('buildAttendanceSummary succeeds', async () => {
    const res = await service.buildAttendanceSummary({
      studentId: 'stu1',
      startDate: new Date('2026-05-01T00:00:00Z'),
      endDate: new Date('2026-05-31T00:00:00Z'),
    })
    expect(res.presentCount).toBe(1)
    expect(res.absenceCount).toBe(1)
    expect(res.lateCount).toBe(1)
  })

  test('listSessionAttendance succeeds', async () => {
    const res = await service.listSessionAttendance('ses1')
    expect(res.length).toBeGreaterThan(0)
  })
})
