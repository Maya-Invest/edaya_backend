import type { SchoolService } from '@edaya/core'
import type { SeedTodayAttendanceRecord } from '@edaya/dev-fixtures'
import type { SeedApplication } from './types'
import {
  AttendanceJustificationStatus,
  AttendanceRecord,
  AttendanceStatus,
  SessionKind,
} from '@edaya/core'
import {
  countSeedAttendanceRecords,
  parseSeedDateTime,
  SEED_ABSENCE_RECORDS,
  SEED_PENDING_JUSTIFICATION_RECORD_IDS,
  SEED_TODAY_ATTENDANCE,
} from '@edaya/dev-fixtures'

const attendanceStatusBySeed = {
  present: AttendanceStatus.Present,
  absent: AttendanceStatus.Absent,
  late: AttendanceStatus.Late,
} as const

async function seedAttendanceSession(
  service: SchoolService,
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
  await service.createSession({
    id: session.sessionId,
    classGroupId: session.classGroupId,
    classSubjectId: session.classSubjectId,
    title: 'Attendance session',
    kind: SessionKind.Course,
    startsAt: parseSeedDateTime(session.date, session.startTime),
    endsAt: parseSeedDateTime(session.date, session.endTime),
  })

  for (const record of session.records) {
    await service.recordAttendance({
      id: record.id,
      studentId: record.studentId,
      sessionId: session.sessionId,
      status: attendanceStatusBySeed[record.status],
    })
  }

  return session.records.length
}

function toAttendanceRecord(existing: AttendanceRecord | Record<string, unknown>): AttendanceRecord {
  return existing instanceof AttendanceRecord
    ? existing
    : new AttendanceRecord(existing as ConstructorParameters<typeof AttendanceRecord>[0])
}

export async function seedAttendanceRecords(
  application: SeedApplication,
  service: SchoolService,
): Promise<number> {
  let recordCount = 0

  for (const absence of SEED_ABSENCE_RECORDS) {
    await service.createSession({
      id: absence.sessionId,
      classGroupId: absence.classGroupId,
      classSubjectId: absence.classSubjectId,
      title: 'Absence session',
      kind: SessionKind.Course,
      startsAt: parseSeedDateTime(absence.date, absence.startTime),
      endsAt: parseSeedDateTime(absence.date, absence.endTime),
    })
    await service.recordAttendance({
      id: absence.id,
      studentId: absence.studentId,
      sessionId: absence.sessionId,
      status: AttendanceStatus.Absent,
    })
    recordCount += 1
  }

  recordCount += await seedAttendanceSession(service, SEED_TODAY_ATTENDANCE)

  const pendingIds = new Set<string>(SEED_PENDING_JUSTIFICATION_RECORD_IDS)
  for (const recordId of pendingIds) {
    const existing = await application.repositories.attendance.findById(recordId)
    if (!existing) {
      continue
    }

    const record = toAttendanceRecord(existing as AttendanceRecord | Record<string, unknown>)
    await service.baseService.attendance.save(record.copyWith({
      justificationStatus: AttendanceJustificationStatus.Pending,
      reason: record.reason ?? 'Awaiting parent justification',
    }), { moduleChecked: true })
  }

  return recordCount
}

export { countSeedAttendanceRecords }
