import type { AttendanceStatus } from '@edaya/core'

export interface AttendanceLessonSessionSeedInput {
  scheduleId: string
  schoolId: string
  classGroupId: string
  classSubjectId: string
  title: string
  date: string
  startTime: string
  endTime: string
}

export interface AttendanceSeedRecord {
  id: string
  studentId: string
  lessonSessionId: string
  status: AttendanceStatus
}

export interface AttendanceSeedPort {
  ensureLessonSession: (input: AttendanceLessonSessionSeedInput) => Promise<{ lessonSessionId: string }>
  recordAttendance: (record: AttendanceSeedRecord) => Promise<void>
  markJustificationPending: (recordId: string, fallbackReason: string) => Promise<void>
}
