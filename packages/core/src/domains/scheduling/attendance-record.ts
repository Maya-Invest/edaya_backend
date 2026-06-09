import type { AuthorizationPolicy } from '../../authorization'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { config, dateTime, indirectTenant, permissionAction, read, resolveSessionSchoolId, unique, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
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
  correctedAt?: Date | null
  correctedByStaffId?: string | null
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
  readonly correctedAt?: Date
  readonly correctedByStaffId?: string
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
    correctedAt,
    correctedByStaffId,
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
    this.correctedAt = correctedAt ? requireValidDate(correctedAt, 'correctedAt') : undefined
    this.correctedByStaffId = requireOptionalNonBlank(correctedByStaffId, 'correctedByStaffId')
    this.createdBy = requireOptionalNonBlank(createdBy, 'createdBy')

    const now = new Date()
    this.createdAt = createdAt ?? now
    this.updatedAt = updatedAt ?? now

    if (this.justifiedByStaffId && !this.justifiedAt) {
      throw new Error('justifiedAt is required when justifiedByStaffId is provided')
    }
    if ((this.correctedAt && !this.correctedByStaffId) || (!this.correctedAt && this.correctedByStaffId)) {
      throw new Error('correctedAt and correctedByStaffId must be provided together')
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

  copyWith(changes: Partial<AttendanceRecordArgs>): AttendanceRecord {
    return new AttendanceRecord({
      id: this.id,
      studentId: this.studentId,
      sessionId: this.sessionId,
      date: this.date,
      status: this.status,
      justificationStatus: this.justificationStatus,
      reason: this.reason,
      notes: this.notes,
      justifiedAt: this.justifiedAt,
      justifiedByStaffId: this.justifiedByStaffId,
      correctedAt: this.correctedAt,
      correctedByStaffId: this.correctedByStaffId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}

export interface SessionAttendanceSummary {
  present: number
  absent: number
  excusedAbsent: number
  late: number
  total: number
}

export function buildSessionAttendanceSummary(records: AttendanceRecord[], expectedTotal: number): SessionAttendanceSummary {
  const summary: SessionAttendanceSummary = {
    present: 0,
    absent: 0,
    excusedAbsent: 0,
    late: 0,
    total: expectedTotal,
  }

  for (const record of records) {
    if (record.status === AttendanceStatus.Present)
      summary.present += 1
    if (record.status === AttendanceStatus.Absent)
      summary.absent += 1
    if (
      record.status === AttendanceStatus.Absent
      && record.justificationStatus === AttendanceJustificationStatus.Excused
    ) {
      summary.excusedAbsent += 1
    }
    if (record.status === AttendanceStatus.Late)
      summary.late += 1
  }

  return summary
}

export const attendanceRecordConfig: EntityConfigFactory<AttendanceRecord> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.attendance,
    tenant: attendanceTenant(),
    read: read(permissionAction(policy, Permission.ATTENDANCE_READ), async (actor, entities) => {
      await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    }),
    write: write(permissionAction(policy, Permission.ATTENDANCE_RECORD), authorizeAttendance(policy), authorizeAttendanceDelete(policy)),
    gates: {
      preSave: validateAttendanceSave,
    },
    atomicExecution,
  })

function attendanceTenant(): EntityTenantResolver<AttendanceRecord> {
  return indirectTenant(async (entity, repositories) => resolveSessionSchoolId(repositories, entity.sessionId))
}

function authorizeAttendance(policy: AuthorizationPolicy): EntityWriteAuthorization<AttendanceRecord>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkAttendanceAccess(actor, [entity.studentId], [entity.sessionId])
  }
}

function authorizeAttendanceDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<AttendanceRecord>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkAttendanceAccess(actor, [entity.studentId], [entity.sessionId])
  }
}

async function validateAttendanceSave(
  entity: AttendanceRecord,
  existing: AttendanceRecord | undefined,
): Promise<void> {
  if (!existing)
    return

  const existingReviewed = isReviewedJustification(existing.justificationStatus)
  const proposedReviewed = isReviewedJustification(entity.justificationStatus)
  const isCorrection = entity.status !== existing.status
  if (isCorrection && existingReviewed) {
    throw new BusinessRuleViolationError('CORRECT_REVIEWED_ATTENDANCE_BLOCKED', 'Reviewed attendance must not be corrected without a reopen workflow')
  }
  if (!proposedReviewed)
    return

  if (existingReviewed && attendanceJustificationChanged(entity, existing)) {
    throw new BusinessRuleViolationError('JUSTIFICATION_ALREADY_REVIEWED', 'Attendance justification has already been reviewed')
  }
  if (existing.status !== AttendanceStatus.Absent || entity.status !== AttendanceStatus.Absent) {
    throw new BusinessRuleViolationError('JUSTIFICATION_ABSENCE_REQUIRED', 'Only an absent attendance record may receive a justification decision')
  }
  if (!entity.reason || entity.reason.trim().length === 0) {
    throw new BusinessRuleViolationError('JUSTIFICATION_REASON_REQUIRED', 'reason is required for an attendance justification decision')
  }
}

function isReviewedJustification(status: AttendanceJustificationStatus): boolean {
  return status === AttendanceJustificationStatus.Excused
    || status === AttendanceJustificationStatus.Rejected
}

function attendanceJustificationChanged(entity: AttendanceRecord, existing: AttendanceRecord): boolean {
  return entity.justificationStatus !== existing.justificationStatus
    || entity.reason !== existing.reason
    || entity.notes !== existing.notes
    || dateTime(entity.justifiedAt) !== dateTime(existing.justifiedAt)
    || entity.justifiedByStaffId !== existing.justifiedByStaffId
}
