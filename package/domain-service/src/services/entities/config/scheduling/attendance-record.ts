import type { AttendanceAnchor, AttendanceRecord } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'

import { AttendanceJustificationStatus, AttendanceStatus, BusinessRuleViolationError, resolveAttendanceRecordSchoolId } from '@edaya/core'
import { config } from '../../entity-config'
import { dateTime } from '../../entity-config/helper-utils'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/scheduling/attendance-record.ts (PR3)
export const attendanceRecordConfig: EntityConfigFactory<AttendanceRecord> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.attendance,
    tenant: attendanceRecordTenant(),
    resource: 'attendance',

    gates: {
      preSave: validateAttendanceSave,
    },
    atomicExecution,
  })

function attendanceRecordTenant(): EntityTenantResolver<AttendanceRecord> {
  return indirectTenant(async (entity, repositories) => resolveAttendanceRecordSchoolId(repositories, entity))
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

export async function findAttendanceRecordByAnchor(
  repositories: Pick<SchoolRepositories, 'attendance'>,
  studentId: string,
  anchor: AttendanceAnchor,
): Promise<AttendanceRecord | undefined> {
  if (anchor.attendanceId) {
    return repositories.attendance.findOne({ studentId, attendanceId: anchor.attendanceId })
  }
  if (anchor.lessonSessionId) {
    return repositories.attendance.findOne({ studentId, lessonSessionId: anchor.lessonSessionId })
  }
  if (anchor.activitySessionId) {
    return repositories.attendance.findOne({ studentId, activitySessionId: anchor.activitySessionId })
  }
  if (anchor.assessmentId) {
    return repositories.attendance.findOne({ studentId, assessmentId: anchor.assessmentId })
  }
  return undefined
}
