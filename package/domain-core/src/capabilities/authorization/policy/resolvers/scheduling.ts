import type { AttendanceRecord } from '../../../../domain/scheduling/attendance-record'
import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import { actorGrantCoversAny } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import {
  SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS,
  SESSION_TEACHING_ACCESS_PERMISSIONS,
} from '../../permissions/groups'
import { checkClassGroupAccess } from './academic'
import { checkStudentAccess } from './student'

export async function checkActivitySessionAccess(
  actor: ActorMetadata,
  activitySessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (activitySessionIds.length === 0) {
    return
  }

  if (actorGrantCoversAny(
    actor,
    SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS,
    'school',
    actor.schoolId,
  )) {
    return
  }

  const uniqueIds = [...new Set(activitySessionIds)]
  const sessionsNeedingClassGroupLookup: string[] = []

  for (const activitySessionId of uniqueIds) {
    const canAccessSession = actorGrantCoversAny(
      actor,
      SESSION_TEACHING_ACCESS_PERMISSIONS,
      'session',
      activitySessionId,
    )

    if (canAccessSession) {
      continue
    }

    sessionsNeedingClassGroupLookup.push(activitySessionId)
  }

  if (sessionsNeedingClassGroupLookup.length === 0) {
    return
  }

  const activitySessions = await repos.activitySessions.findByIds(sessionsNeedingClassGroupLookup)
  if (activitySessions.length !== sessionsNeedingClassGroupLookup.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const classGroupIds = [...new Set(activitySessions.map(session => session.classGroupId))]
  await checkClassGroupAccess(actor, classGroupIds, repos)
}

export async function checkLessonSessionAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (lessonSessionIds.length === 0) {
    return
  }

  if (actorGrantCoversAny(
    actor,
    SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS,
    'school',
    actor.schoolId,
  )) {
    return
  }

  const uniqueIds = [...new Set(lessonSessionIds)]
  const sessionsNeedingClassGroupLookup: string[] = []

  for (const lessonSessionId of uniqueIds) {
    const canAccessSession = actorGrantCoversAny(
      actor,
      SESSION_TEACHING_ACCESS_PERMISSIONS,
      'session',
      lessonSessionId,
    )

    if (canAccessSession) {
      continue
    }

    sessionsNeedingClassGroupLookup.push(lessonSessionId)
  }

  if (sessionsNeedingClassGroupLookup.length === 0) {
    return
  }

  const lessonSessions = await repos.lessonSessions.findByIds(sessionsNeedingClassGroupLookup)
  if (lessonSessions.length !== sessionsNeedingClassGroupLookup.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const classGroupIds = [...new Set(lessonSessions.map(session => session.classGroupId))]
  await checkClassGroupAccess(actor, classGroupIds, repos)
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
