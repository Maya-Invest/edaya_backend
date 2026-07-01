import type { SeedTodayAttendanceRecord } from '@edaya/fixtures'
import type { AttendanceSeedPort } from './port'
import { AttendanceStatus } from '@edaya/core'
import {
  SEED_ABSENCE_RECORDS,
  SEED_PENDING_JUSTIFICATION_RECORD_IDS,
  SEED_SCHOOL_ID,
  SEED_TODAY_ATTENDANCE,
} from '@edaya/fixtures'

const ATTENDANCE_STATUS_BY_SEED = {
  present: AttendanceStatus.Present,
  absent: AttendanceStatus.Absent,
  late: AttendanceStatus.Late,
} as const

async function seedAttendanceSession(
  port: AttendanceSeedPort,
  session: {
    scheduleId: string
    classGroupId: string
    classSubjectId: string
    date: string
    startTime: string
    endTime: string
    records: readonly SeedTodayAttendanceRecord[]
  },
): Promise<number> {
  const { lessonSessionId } = await port.ensureLessonSession({
    scheduleId: session.scheduleId,
    schoolId: SEED_SCHOOL_ID,
    classGroupId: session.classGroupId,
    classSubjectId: session.classSubjectId,
    title: 'Attendance session',
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
  })

  for (const record of session.records) {
    await port.recordAttendance({
      id: record.id,
      studentId: record.studentId,
      lessonSessionId,
      status: ATTENDANCE_STATUS_BY_SEED[record.status],
    })
  }

  return session.records.length
}

export async function seedDevAttendance(port: AttendanceSeedPort): Promise<number> {
  let recordCount = 0

  for (const absence of SEED_ABSENCE_RECORDS) {
    const scheduleId = absence.scheduleId
    const { lessonSessionId } = await port.ensureLessonSession({
      scheduleId,
      schoolId: SEED_SCHOOL_ID,
      classGroupId: absence.classGroupId,
      classSubjectId: absence.classSubjectId,
      title: 'Absence session',
      date: absence.date,
      startTime: absence.startTime,
      endTime: absence.endTime,
    })
    await port.recordAttendance({
      id: absence.id,
      studentId: absence.studentId,
      lessonSessionId,
      status: AttendanceStatus.Absent,
    })
    recordCount += 1
  }

  recordCount += await seedAttendanceSession(port, {
    scheduleId: SEED_TODAY_ATTENDANCE.scheduleId,
    classGroupId: SEED_TODAY_ATTENDANCE.classGroupId,
    classSubjectId: SEED_TODAY_ATTENDANCE.classSubjectId,
    date: SEED_TODAY_ATTENDANCE.date,
    startTime: SEED_TODAY_ATTENDANCE.startTime,
    endTime: SEED_TODAY_ATTENDANCE.endTime,
    records: SEED_TODAY_ATTENDANCE.records,
  })

  for (const recordId of new Set<string>(SEED_PENDING_JUSTIFICATION_RECORD_IDS)) {
    await port.markJustificationPending(recordId, 'Awaiting parent justification')
  }

  return recordCount
}
