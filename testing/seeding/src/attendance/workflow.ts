import type { SeedTodayAttendanceRecord } from '@edaya/dev-fixtures'
import type { AttendanceSeedPort } from './port'
import { AttendanceStatus, SessionKind } from '@edaya/core'
import {
  SEED_ABSENCE_RECORDS,
  SEED_PENDING_JUSTIFICATION_RECORD_IDS,
  SEED_TODAY_ATTENDANCE,
} from '@edaya/dev-fixtures'
import { seedDateAndTime } from '../seed-date'

const ATTENDANCE_STATUS_BY_SEED = {
  present: AttendanceStatus.Present,
  absent: AttendanceStatus.Absent,
  late: AttendanceStatus.Late,
} as const

async function seedAttendanceSession(
  port: AttendanceSeedPort,
  session: {
    sessionId: string
    classGroupId: string
    classSubjectId: string
    date: string
    startTime: string
    endTime: string
    records: readonly SeedTodayAttendanceRecord[]
  },
): Promise<number> {
  await port.createSession({
    id: session.sessionId,
    classGroupId: session.classGroupId,
    classSubjectId: session.classSubjectId,
    title: 'Attendance session',
    kind: SessionKind.Course,
    startsAt: seedDateAndTime(session.date, session.startTime),
    endsAt: seedDateAndTime(session.date, session.endTime),
  })

  for (const record of session.records) {
    await port.recordAttendance({
      id: record.id,
      studentId: record.studentId,
      sessionId: session.sessionId,
      status: ATTENDANCE_STATUS_BY_SEED[record.status],
    })
  }

  return session.records.length
}

export async function seedDevAttendance(port: AttendanceSeedPort): Promise<number> {
  let recordCount = 0

  for (const absence of SEED_ABSENCE_RECORDS) {
    await port.createSession({
      id: absence.sessionId,
      classGroupId: absence.classGroupId,
      classSubjectId: absence.classSubjectId,
      title: 'Absence session',
      kind: SessionKind.Course,
      startsAt: seedDateAndTime(absence.date, absence.startTime),
      endsAt: seedDateAndTime(absence.date, absence.endTime),
    })
    await port.recordAttendance({
      id: absence.id,
      studentId: absence.studentId,
      sessionId: absence.sessionId,
      status: AttendanceStatus.Absent,
    })
    recordCount += 1
  }

  recordCount += await seedAttendanceSession(port, SEED_TODAY_ATTENDANCE)

  for (const recordId of new Set<string>(SEED_PENDING_JUSTIFICATION_RECORD_IDS)) {
    await port.markJustificationPending(recordId, 'Awaiting parent justification')
  }

  return recordCount
}
