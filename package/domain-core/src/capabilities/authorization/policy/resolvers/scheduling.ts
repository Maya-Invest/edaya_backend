import type { AttendanceRecord } from '../../../../domain/scheduling/attendance-record'
import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import {
  actorGrantCoversAnyResourcePath,
  actorHasSchoolWideGrant,
} from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { resourcePathForActivity, resourcePathForClassSubject } from '../../scope/resolve-resource-path'
import { checkClassGroupAccess } from './academic'
import {
  SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS,
  SESSION_TEACHING_ACCESS_PERMISSIONS,
} from './permission-sets'
import { checkStudentAccess } from './student'

export async function checkActivitySessionAccess(
  actor: ActorMetadata,
  activitySessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (activitySessionIds.length === 0) {
    return
  }

  if (actorHasSchoolWideGrant(actor, SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS)) {
    return
  }

  const uniqueIds = [...new Set(activitySessionIds)]
  const activitySessions = await repos.activitySessions.findByIds(uniqueIds)
  if (activitySessions.length !== uniqueIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const classGroupIds = new Set<string>()
  for (const session of activitySessions) {
    const resourcePath = resourcePathForActivity(session.activityId, session.classGroupId)
    if (actorGrantCoversAnyResourcePath(actor, SESSION_TEACHING_ACCESS_PERMISSIONS, resourcePath)) {
      continue
    }
    classGroupIds.add(session.classGroupId)
  }

  if (classGroupIds.size === 0) {
    return
  }

  await checkClassGroupAccess(actor, [...classGroupIds], repos)
}

export async function checkLessonSessionAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (lessonSessionIds.length === 0) {
    return
  }

  if (actorHasSchoolWideGrant(actor, SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS)) {
    return
  }

  const uniqueIds = [...new Set(lessonSessionIds)]
  const lessonSessions = await repos.lessonSessions.findByIds(uniqueIds)
  if (lessonSessions.length !== uniqueIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const classGroupIds = new Set<string>()
  for (const session of lessonSessions) {
    const resourcePath = resourcePathForClassSubject(session.classGroupId, session.classSubjectId)
    if (actorGrantCoversAnyResourcePath(actor, SESSION_TEACHING_ACCESS_PERMISSIONS, resourcePath)) {
      continue
    }
    classGroupIds.add(session.classGroupId)
  }

  if (classGroupIds.size === 0) {
    return
  }

  await checkClassGroupAccess(actor, [...classGroupIds], repos)
}

export async function checkAttendanceRecordAccess(
  actor: ActorMetadata,
  records: readonly AttendanceRecord[],
  repos: SchoolRepositories,
): Promise<void> {
  if (records.length === 0) {
    return
  }

  const studentIds = [...new Set(records.map(record => record.studentId))]
  const lessonSessionIds = [...new Set(records.map(record => record.lessonSessionId).filter((id): id is string => Boolean(id)))]
  const attendanceIds = [...new Set(records.map(record => record.attendanceId).filter((id): id is string => Boolean(id)))]

  const activitySessionIds = [...new Set(records.map(record => record.activitySessionId).filter((id): id is string => Boolean(id)))]

  await checkStudentAccess(actor, studentIds, repos)

  if (lessonSessionIds.length > 0) {
    await checkLessonSessionAccess(actor, lessonSessionIds, repos)
  }

  if (activitySessionIds.length > 0) {
    await checkActivitySessionAccess(actor, activitySessionIds, repos)
  }

  if (attendanceIds.length > 0) {
    const attendances = await repos.attendances.findByIds(attendanceIds)
    if (attendances.length !== attendanceIds.length) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    const classGroupIds = [...new Set(attendances.map(attendance => attendance.classGroupId))]
    await checkClassGroupAccess(actor, classGroupIds, repos)
  }
}
