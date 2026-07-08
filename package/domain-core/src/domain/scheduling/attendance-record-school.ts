import type { CoreEntityRepositories } from '@edaya/core'
import type { AttendanceRecord } from './attendance-record'

export async function resolveAttendanceRecordSchoolId(
  repositories: CoreEntityRepositories,
  record: AttendanceRecord,
): Promise<string | undefined> {
  if (record.attendanceId) {
    const attendance = await repositories.attendances.findById(record.attendanceId)
    return attendance?.schoolId
  }
  if (record.lessonSessionId) {
    const lessonSession = await repositories.lessonSessions.findById(record.lessonSessionId)
    return lessonSession?.schoolId
  }
  if (record.activitySessionId) {
    const activitySession = await repositories.activitySessions.findById(record.activitySessionId)
    return activitySession?.schoolId
  }
  if (record.assessmentId) {
    const assessment = await repositories.assessments.findById(record.assessmentId)
    if (!assessment) {
      return undefined
    }
    const classGroup = await repositories.classGroups.findById(assessment.classGroupId)
    return classGroup?.schoolId
  }
  return undefined
}
