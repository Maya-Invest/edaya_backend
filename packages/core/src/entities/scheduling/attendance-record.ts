import { normalizeDate, requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum AttendanceStatus {
  Present = 'present',
  Absent = 'absent',
  Late = 'late',
}

export enum AttendanceJustificationStatus {
  None = 'none',
  Pending = 'pending',
  Excused = 'excused',
  Rejected = 'rejected',
}

export interface AttendanceRecordArgs {
  id: string
  studentId: string
  sessionId: string
  date: Date
  status: AttendanceStatus
  justificationStatus?: AttendanceJustificationStatus
  reason?: string | null
  notes?: string | null
  justifiedAt?: Date | null
  justifiedByStaffId?: string | null
  createdBy?: string
  createdAt?: Date
  updatedAt?: Date
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
  readonly justificationStatus: AttendanceJustificationStatus
  readonly reason?: string
  readonly notes?: string
  readonly justifiedAt?: Date
  readonly justifiedByStaffId?: string
  readonly createdBy?: string
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    studentId,
    sessionId,
    date,
    status,
    justificationStatus = AttendanceJustificationStatus.None,
    reason,
    notes,
    justifiedAt,
    justifiedByStaffId,
    createdBy,
    createdAt,
    updatedAt,
  }: AttendanceRecordArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.sessionId = requireNonBlank(sessionId, 'sessionId')
    this.date = normalizeDate(requireValidDate(date, 'date'))
    this.status = status
    this.justificationStatus = justificationStatus
    this.reason = requireOptionalNonBlank(reason, 'reason')
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.justifiedAt = justifiedAt ? requireValidDate(justifiedAt, 'justifiedAt') : undefined
    this.justifiedByStaffId = requireOptionalNonBlank(justifiedByStaffId, 'justifiedByStaffId')
    this.createdBy = requireOptionalNonBlank(createdBy, 'createdBy')

    const now = new Date()
    this.createdAt = createdAt ?? now
    this.updatedAt = updatedAt ?? now

    if (this.justifiedByStaffId && !this.justifiedAt) {
      throw new Error('justifiedAt is required when justifiedByStaffId is provided')
    }
    if (
      this.justificationStatus !== AttendanceJustificationStatus.None
      && this.status === AttendanceStatus.Present
    ) {
      throw new Error('present attendance must not carry an absence justification')
    }
    if (
      (this.justificationStatus === AttendanceJustificationStatus.Excused
        || this.justificationStatus === AttendanceJustificationStatus.Rejected)
      && (!this.justifiedAt || !this.justifiedByStaffId)
    ) {
      throw new Error('reviewed justifications must identify the reviewing staff member and time')
    }
  }
}
