import { normalizeDate, requireNonBlank, requireValidDate } from '$lib/core/utils/validation'

export enum AttendanceStatus {
  Present = 'present',
  Absent = 'absent',
  Late = 'late',
  Excused = 'excused',
}

export interface AttendanceRecordArgs {
  id: string
  studentId: string
  sessionId: string
  date: Date
  status: AttendanceStatus
  createdBy?: string
  createdAt?: Date
}

/**
 * Records the presence, absence, or tardiness of a student on a specific date,
 * typically associated with a particular subject or daily check-in.
 */
export class AttendanceRecord {
  readonly id: string
  readonly studentId: string
  readonly sessionId: string
  readonly date: Date
  readonly status: AttendanceStatus
  readonly createdBy?: string
  readonly createdAt: Date

  constructor({ id, studentId, sessionId, date, status, createdBy, createdAt }: AttendanceRecordArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.sessionId = requireNonBlank(sessionId, 'sessionId')
    this.date = normalizeDate(requireValidDate(date, 'date'))
    this.status = status
    this.createdBy = createdBy
    this.createdAt = createdAt ?? new Date()
  }
}
