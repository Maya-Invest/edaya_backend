import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import {
  SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS,
  SESSION_TEACHING_ACCESS_PERMISSIONS,
} from '../resolver-permissions'
import { checkClassGroupAccess } from './academic-resolver'
import { actorGrantCoversAny } from './grant-resolver'
import { checkStudentAccess } from './student-resolver'

export async function checkSessionAccess(
  actor: ActorMetadata,
  sessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (sessionIds.length === 0 || actor.kind === 'system') {
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
