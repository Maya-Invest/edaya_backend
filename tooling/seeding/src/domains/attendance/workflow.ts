import type { AttendanceRecordInput } from '@edaya/core'
import type { FixtureAttendanceSession, FixtureDailyAttendanceDay, FixtureDataset } from '@edaya/fixtures'
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

async function seedDailyAttendanceDay(
  port: AttendanceSeedPort,
  day: FixtureDailyAttendanceDay,
): Promise<number> {
  for (const record of day.records) {
    await port.recordDailyAttendance({
      id: record.id,
      studentId: record.studentId,
      classGroupId: day.classGroupId,
      date: day.date,
      status: record.status,
    })
  }
  return day.records.length
}

export async function seedDevAttendance(
  port: AttendanceSeedPort,
  dataset: FixtureDataset,
): Promise<number> {
  let recordCount = 0

  const dailyDays = dataset.extensions?.dailyAttendanceDays
  if (dailyDays) {
    for (const day of dailyDays) {
      recordCount += await seedDailyAttendanceDay(port, day)
    }
  }

  if (dataset.extensions?.skipLessonSessionSeeding) {
    return recordCount
  }

  const attendanceSessions = dataset.extensions?.attendanceSessions
  if (!attendanceSessions) {
    return recordCount
  }

  for (const absenceSession of attendanceSessions.absenceSessions) {
    recordCount += await seedAttendanceSession(port, dataset.schoolId, absenceSession)
  }

  recordCount += await seedAttendanceSession(port, dataset.schoolId, attendanceSessions.todaySession)

  for (const recordId of new Set<string>(attendanceSessions.pendingJustificationRecordIds)) {
    await port.markJustificationPending(recordId, 'Awaiting parent justification')
  }

  return recordCount
}
