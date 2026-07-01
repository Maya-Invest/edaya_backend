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

export async function checkSessionAccess(
  actor: ActorMetadata,
  sessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (sessionIds.length === 0) {
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

  const uniqueSessionIds = [...new Set(sessionIds)]
  const sessionsNeedingClassGroupLookup: string[] = []

  for (const sessionId of uniqueSessionIds) {
    const canAccessSession = actorGrantCoversAny(
      actor,
      SESSION_TEACHING_ACCESS_PERMISSIONS,
      'session',
      sessionId,
    )

    if (canAccessSession) {
      continue
    }

    sessionsNeedingClassGroupLookup.push(sessionId)
  }

  if (sessionsNeedingClassGroupLookup.length === 0) {
    return
  }

  const sessions = await repos.sessions.findByIds(sessionsNeedingClassGroupLookup)
  if (sessions.length !== sessionsNeedingClassGroupLookup.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const classGroupIds = [...new Set(sessions.map(session => session.classGroupId))]
  await checkClassGroupAccess(actor, classGroupIds, repos)
}

export async function checkAttendanceAccess(
  actor: ActorMetadata,
  studentIds: readonly string[],
  sessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  await Promise.all([
    checkStudentAccess(actor, studentIds, repos),
    checkSessionAccess(actor, sessionIds, repos),
  ])
}
