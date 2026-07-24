import type { AttendanceRecordInput } from '@edaya/core'
import type { FixtureAttendanceSession } from '../../types'
import { AttendanceStatus } from '@edaya/core'

export const demoCiAttendanceAbsenceSessions = [
  {
    session: {
      scheduleId: 'sch-ci-sess-abs-a1',
      classGroupId: 'ci-6a',
      classSubjectId: 'ci-cs-6a-math',
      title: 'Séance d\'absence',
      date: '2026-05-12',
      startTime: '08:15',
      endTime: '09:00',
    },
    records: [{
      id: 'ci-a1',
      studentId: 'ci-s1',
      lessonSessionId: 'sch-ci-sess-abs-a1:2026-05-12',
      date: '2026-05-12T12:00:00.000Z',
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
      date: '2026-05-06',
      startTime: '10:00',
      endTime: '10:45',
    },
    records: [{
      id: 'ci-a2',
      studentId: 'ci-s1',
      lessonSessionId: 'sch-ci-sess-abs-a2:2026-05-06',
      date: '2026-05-06T12:00:00.000Z',
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
      date: '2026-05-05',
      startTime: '09:15',
      endTime: '10:00',
    },
    records: [{
      id: 'ci-a3',
      studentId: 'ci-s2',
      lessonSessionId: 'sch-ci-sess-abs-a3:2026-05-05',
      date: '2026-05-05T12:00:00.000Z',
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
      date: '2026-05-15',
      startTime: '09:15',
      endTime: '10:00',
    },
    records: [{
      id: 'ci-a4',
      studentId: 'ci-s3',
      lessonSessionId: 'sch-ci-sess-abs-a4:2026-05-15',
      date: '2026-05-15T12:00:00.000Z',
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
      date: '2026-05-07',
      startTime: '08:15',
      endTime: '09:00',
    },
    records: [{
      id: 'ci-a5',
      studentId: 'ci-s11',
      lessonSessionId: 'sch-ci-sess-abs-a5:2026-05-07',
      date: '2026-05-07T12:00:00.000Z',
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
      date: '2026-03-18',
      startTime: '08:15',
      endTime: '09:00',
    },
    records: [{
      id: 'ci-a6',
      studentId: 'ci-s28',
      lessonSessionId: 'sch-ci-sess-abs-a6:2026-03-18',
      date: '2026-03-18T12:00:00.000Z',
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
    date: '2026-06-16',
    startTime: '08:15',
    endTime: '09:00',
  },
  records: [
    { id: 'ci-att-today-s1', studentId: 'ci-s1', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-06-16', date: '2026-06-16T12:00:00.000Z', status: AttendanceStatus.Present, reason: undefined },
    { id: 'ci-att-today-s2', studentId: 'ci-s2', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-06-16', date: '2026-06-16T12:00:00.000Z', status: AttendanceStatus.Present, reason: undefined },
    { id: 'ci-att-today-s3', studentId: 'ci-s3', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-06-16', date: '2026-06-16T12:00:00.000Z', status: AttendanceStatus.Absent, reason: 'Absence signalée par les parents' },
    { id: 'ci-att-today-s4', studentId: 'ci-s4', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-06-16', date: '2026-06-16T12:00:00.000Z', status: AttendanceStatus.Present, reason: undefined },
    { id: 'ci-att-today-s5', studentId: 'ci-s5', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-06-16', date: '2026-06-16T12:00:00.000Z', status: AttendanceStatus.Late, reason: undefined },
    { id: 'ci-att-today-s6', studentId: 'ci-s6', lessonSessionId: 'sch-ci-sess-att-today-6a:2026-06-16', date: '2026-06-16T12:00:00.000Z', status: AttendanceStatus.Present, reason: undefined },
  ],
} as const satisfies FixtureAttendanceSession

/** Daily roll-call days for `attendanceMode: daily` classes (class attendance page). */
export const demoCiDailyAttendanceDays = [
  {
    classGroupId: 'ci-6a',
    date: '2026-06-16',
    records: [
      { id: 'ci-daily-6a-0616-s1', studentId: 'ci-s1', status: AttendanceStatus.Present },
      { id: 'ci-daily-6a-0616-s2', studentId: 'ci-s2', status: AttendanceStatus.Present },
      { id: 'ci-daily-6a-0616-s3', studentId: 'ci-s3', status: AttendanceStatus.Absent, reason: 'Absence signalée par les parents' },
      { id: 'ci-daily-6a-0616-s4', studentId: 'ci-s4', status: AttendanceStatus.Present },
      { id: 'ci-daily-6a-0616-s5', studentId: 'ci-s5', status: AttendanceStatus.Late },
      { id: 'ci-daily-6a-0616-s6', studentId: 'ci-s6', status: AttendanceStatus.Present },
    ],
  },
  {
    classGroupId: 'ci-6a',
    date: '2026-06-13',
    records: [
      { id: 'ci-daily-6a-0613-s1', studentId: 'ci-s1', status: AttendanceStatus.Present },
      { id: 'ci-daily-6a-0613-s2', studentId: 'ci-s2', status: AttendanceStatus.Present },
      { id: 'ci-daily-6a-0613-s3', studentId: 'ci-s3', status: AttendanceStatus.Present },
      { id: 'ci-daily-6a-0613-s4', studentId: 'ci-s4', status: AttendanceStatus.Absent, reason: 'Rendez-vous médical' },
      { id: 'ci-daily-6a-0613-s5', studentId: 'ci-s5', status: AttendanceStatus.Present },
      { id: 'ci-daily-6a-0613-s6', studentId: 'ci-s6', status: AttendanceStatus.Present },
    ],
  },
  {
    classGroupId: 'ci-6b',
    date: '2026-06-16',
    records: [
      { id: 'ci-daily-6b-0616-s7', studentId: 'ci-s7', status: AttendanceStatus.Present },
      { id: 'ci-daily-6b-0616-s8', studentId: 'ci-s8', status: AttendanceStatus.Late },
      { id: 'ci-daily-6b-0616-s9', studentId: 'ci-s9', status: AttendanceStatus.Present },
      { id: 'ci-daily-6b-0616-s10', studentId: 'ci-s10', status: AttendanceStatus.Present },
    ],
  },
] as const satisfies readonly import('../../types').FixtureDailyAttendanceDay[]

export const demoCiPendingJustificationRecordIds = [
  'ci-att-today-s3',
  'ci-daily-6a-0616-s3',
  'ci-a3',
  'ci-a4',
] as const

export const demoCiAttendanceRecords = [
  ...(demoCiAttendanceAbsenceSessions as readonly FixtureAttendanceSession[]).flatMap(session => session.records),
  ...demoCiTodayAttendanceSession.records,
] satisfies readonly AttendanceRecordInput[]
