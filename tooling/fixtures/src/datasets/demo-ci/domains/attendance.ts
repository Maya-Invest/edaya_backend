import type { AttendanceRecordInput } from '@edaya/core'
import type { FixtureAttendanceSession, FixtureDailyAttendanceDay } from '../../types'
import { AttendanceStatus } from '@edaya/core'

const CI_6A_STUDENT_IDS = ['ci-s1', 'ci-s2', 'ci-s3', 'ci-s4', 'ci-s5', 'ci-s6'] as const
const CI_6B_STUDENT_IDS = ['ci-s7', 'ci-s8', 'ci-s9', 'ci-s10', 'ci-s14', 'ci-s15'] as const

function allPresent(studentIds: readonly string[]): Record<string, AttendanceStatus> {
  return Object.fromEntries(studentIds.map(id => [id, AttendanceStatus.Present]))
}

function dailyDaysForClass(
  classGroupId: string,
  studentIds: readonly string[],
): readonly FixtureDailyAttendanceDay[] {
  const first = studentIds[0]
  const second = studentIds[1]
  return [
    { classGroupId, date: '2026-09-17', attendanceByStudent: allPresent(studentIds) },
    {
      classGroupId,
      date: '2026-09-18',
      attendanceByStudent: first && second
        ? { [first]: AttendanceStatus.Present, [second]: AttendanceStatus.Absent }
        : {},
    },
    { classGroupId, date: '2026-09-21', attendanceByStudent: {} },
  ]
}

export const demoCiDailyAttendanceDays = [
  ...dailyDaysForClass('ci-6a', CI_6A_STUDENT_IDS),
  ...dailyDaysForClass('ci-6b', CI_6B_STUDENT_IDS),
] as const satisfies readonly FixtureDailyAttendanceDay[]

export const demoCiAttendanceAbsenceSessions = [
  {
    session: {
      scheduleId: 'sch-ci-sess-abs-a1',
      classGroupId: 'ci-6a',
      classSubjectId: 'ci-cs-6a-math',
      title: 'Séance d\'absence',
      date: '2026-09-16',
      startTime: '08:15',
      endTime: '09:00',
    },
    records: [{
      id: 'ci-a1',
      studentId: 'ci-s1',
      lessonSessionId: 'sch-ci-sess-abs-a1:2026-09-16',
      date: '2026-09-16T12:00:00.000Z',
      status: AttendanceStatus.Absent,
      reason: 'Maladie',
    }],
  },
  {
    session: {
      scheduleId: 'sch-ci-sess-abs-a2',
      classGroupId: 'ci-6a',
      classSubjectId: 'ci-cs-6a-hg',
      title: 'Séance d\'absence',
      date: '2026-09-15',
      startTime: '10:00',
      endTime: '10:45',
    },
    records: [{
      id: 'ci-a2',
      studentId: 'ci-s1',
      lessonSessionId: 'sch-ci-sess-abs-a2:2026-09-15',
      date: '2026-09-15T12:00:00.000Z',
      status: AttendanceStatus.Absent,
      reason: 'Rendez-vous médical',
    }],
  },
  {
    session: {
      scheduleId: 'sch-ci-sess-abs-a3',
      classGroupId: 'ci-6a',
      classSubjectId: 'ci-cs-6a-ang',
      title: 'Séance d\'absence',
      date: '2026-09-14',
      startTime: '09:15',
      endTime: '10:00',
    },
    records: [{
      id: 'ci-a3',
      studentId: 'ci-s2',
      lessonSessionId: 'sch-ci-sess-abs-a3:2026-09-14',
      date: '2026-09-14T12:00:00.000Z',
      status: AttendanceStatus.Absent,
      reason: undefined,
    }],
  },
  {
    session: {
      scheduleId: 'sch-ci-sess-abs-a4',
      classGroupId: 'ci-6a',
      classSubjectId: 'ci-cs-6a-svt',
      title: 'Séance d\'absence',
      date: '2026-09-17',
      startTime: '09:15',
      endTime: '10:00',
    },
    records: [{
      id: 'ci-a4',
      studentId: 'ci-s3',
      lessonSessionId: 'sch-ci-sess-abs-a4:2026-09-17',
      date: '2026-09-17T12:00:00.000Z',
      status: AttendanceStatus.Absent,
      reason: 'Non justifiée',
    }],
  },
  {
    session: {
      scheduleId: 'sch-ci-sess-abs-a5',
      classGroupId: 'ci-5a',
      classSubjectId: 'ci-cs-5a-math',
      title: 'Séance d\'absence',
      date: '2026-09-16',
      startTime: '08:15',
      endTime: '09:00',
    },
    records: [{
      id: 'ci-a5',
      studentId: 'ci-s11',
      lessonSessionId: 'sch-ci-sess-abs-a5:2026-09-16',
      date: '2026-09-16T12:00:00.000Z',
      status: AttendanceStatus.Absent,
      reason: 'Maladie',
    }],
  },
  {
    session: {
      scheduleId: 'sch-ci-sess-abs-a6',
      classGroupId: 'ci-3a',
      classSubjectId: 'ci-cs-3a-math',
      title: 'Séance d\'absence',
      date: '2026-09-18',
      startTime: '08:15',
      endTime: '09:00',
    },
    records: [{
      id: 'ci-a6',
      studentId: 'ci-s28',
      lessonSessionId: 'sch-ci-sess-abs-a6:2026-09-18',
      date: '2026-09-18T12:00:00.000Z',
      status: AttendanceStatus.Absent,
      reason: undefined,
    }],
  },
] as const satisfies readonly FixtureAttendanceSession[]

export const demoCiTodayAttendanceSession = {
  session: {
    scheduleId: 'sch-ci-sess-att-today-6a',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-math',
    title: 'Appel du jour',
    date: '2026-09-17',
    startTime: '08:15',
    endTime: '09:00',
  },
  records: [
    { id: 'ci-att-today-s1', studentId: 'ci-s1', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-09-17', date: '2026-09-17T12:00:00.000Z', status: AttendanceStatus.Present, reason: undefined },
    { id: 'ci-att-today-s2', studentId: 'ci-s2', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-09-17', date: '2026-09-17T12:00:00.000Z', status: AttendanceStatus.Present, reason: undefined },
    { id: 'ci-att-today-s3', studentId: 'ci-s3', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-09-17', date: '2026-09-17T12:00:00.000Z', status: AttendanceStatus.Absent, reason: 'Absence signalée par les parents' },
    { id: 'ci-att-today-s4', studentId: 'ci-s4', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-09-17', date: '2026-09-17T12:00:00.000Z', status: AttendanceStatus.Present, reason: undefined },
    { id: 'ci-att-today-s5', studentId: 'ci-s5', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-09-17', date: '2026-09-17T12:00:00.000Z', status: AttendanceStatus.Late, reason: undefined },
    { id: 'ci-att-today-s6', studentId: 'ci-s6', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-09-17', date: '2026-09-17T12:00:00.000Z', status: AttendanceStatus.Present, reason: undefined },
  ],
} as const satisfies FixtureAttendanceSession

export const demoCiPendingJustificationRecordIds = [
  'ci-att-today-s3',
  'ci-a3',
  'ci-a4',
] as const

export const demoCiAttendanceRecords = [
  ...(demoCiAttendanceAbsenceSessions as readonly FixtureAttendanceSession[]).flatMap(session => session.records),
  ...demoCiTodayAttendanceSession.records,
] satisfies readonly AttendanceRecordInput[]
