import type { AttendanceStatus, SessionKind } from '@edaya/core'

export interface AttendanceSessionSeedRecord {
  id: string
  classGroupId: string
  classSubjectId: string
  title: string
  kind: SessionKind
  startsAt: string
  endsAt: string
}

export interface AttendanceSeedRecord {
  id: string
  studentId: string
  sessionId: string
  status: AttendanceStatus
}

export interface AttendanceSeedPort {
  createSession: (record: AttendanceSessionSeedRecord) => Promise<void>
  recordAttendance: (record: AttendanceSeedRecord) => Promise<void>
  markJustificationPending: (recordId: string, fallbackReason: string) => Promise<void>
}
