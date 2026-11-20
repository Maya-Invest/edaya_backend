import type { AttendanceRecordInput } from '@edaya/core'
import type { FixtureAttendanceSession, FixtureDataset } from '@edaya/fixtures'
import type { AttendanceSeedPort } from './port'

function attendanceSeedRecord(record: AttendanceRecordInput) {
  const lessonSessionId = record.lessonSessionId
  if (typeof lessonSessionId !== 'string' || lessonSessionId.length === 0) {
    throw new Error(`Attendance record ${record.id} is missing lessonSessionId`)
  }
  return {
    id: record.id,
    studentId: record.studentId,
    lessonSessionId,
    status: record.status,
  }
}

async function seedAttendanceSession(
  port: AttendanceSeedPort,
  schoolId: string,
  session: FixtureAttendanceSession,
): Promise<number> {
  const { lessonSessionId } = await port.ensureLessonSession({
    scheduleId: session.session.scheduleId,
    schoolId,
    classGroupId: session.session.classGroupId,
    classSubjectId: session.session.classSubjectId,
    title: session.session.title,
    date: session.session.date,
    startTime: session.session.startTime,
    endTime: session.session.endTime,
  })

  for (const record of session.records) {
    const seedRecord = attendanceSeedRecord(record)
    if (seedRecord.lessonSessionId !== lessonSessionId) {
      throw new Error(`Attendance record ${record.id} lessonSessionId does not match materialized session`)
    }
    await port.recordAttendance(seedRecord)
  }

  return session.records.length
}

export async function seedDevAttendance(
  port: AttendanceSeedPort,
  dataset: FixtureDataset,
): Promise<number> {
  if (dataset.extensions?.skipLessonSessionSeeding) {
    return 0
  }

  const attendanceSessions = dataset.extensions?.attendanceSessions
  if (!attendanceSessions) {
    return 0
  }

  let recordCount = 0

  for (const absenceSession of attendanceSessions.absenceSessions) {
    recordCount += await seedAttendanceSession(port, dataset.schoolId, absenceSession)
  }

  recordCount += await seedAttendanceSession(port, dataset.schoolId, attendanceSessions.todaySession)

  for (const recordId of new Set<string>(attendanceSessions.pendingJustificationRecordIds)) {
    await port.markJustificationPending(recordId, 'Awaiting parent justification')
  }

  for (const day of dataset.extensions?.dailyAttendanceDays ?? []) {
    await port.recordClassDailyAttendance({
      classGroupId: day.classGroupId,
      date: new Date(`${day.date}T12:00:00.000Z`),
      attendanceByStudent: { ...day.attendanceByStudent },
    })
    recordCount += Object.keys(day.attendanceByStudent).length
  }

  return recordCount
}
