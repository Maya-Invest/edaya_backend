import { requireNonBlank } from '$lib/core/validation'

export enum DeadlineComplianceStatus {
  Met = 'met',
  Late = 'late',
  Missed = 'missed',
  Excused = 'excused',
}

export interface DeadlineRecordArgs {
  id: string
  studentId: string
  deadlineId: string
  status: DeadlineComplianceStatus
  notes?: string | null
  createdBy?: string
  createdAt?: Date
}

/**
 * Records a student's compliance with a specific deadline.
 */
export class DeadlineRecord {
  readonly id: string
  readonly studentId: string
  readonly deadlineId: string
  readonly status: DeadlineComplianceStatus
  readonly notes?: string
  readonly createdBy?: string
  readonly createdAt: Date

  constructor({ id, studentId, deadlineId, status, notes, createdBy, createdAt }: DeadlineRecordArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.deadlineId = requireNonBlank(deadlineId, 'deadlineId')
    this.status = status
    this.notes = notes ?? undefined
    this.createdBy = createdBy
    this.createdAt = createdAt ?? new Date()
  }
}
