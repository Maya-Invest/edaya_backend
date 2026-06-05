import type { AuthorizationPolicy } from '../../../authorization'
import type { AttendanceRecord } from '../../../entities/scheduling/attendance-record'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { Permission } from '../../../authorization'
import { AttendanceJustificationStatus, AttendanceStatus } from '../../../entities/scheduling/attendance-record'
import { config, dateTime, indirectTenant, permissionAction, read, resolveSessionSchoolId, unique, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

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
