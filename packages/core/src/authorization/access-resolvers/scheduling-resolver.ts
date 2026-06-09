import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { Permission } from '../permissions'
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

  if (actorGrantCoversAny(actor, [
    Permission.QUERY_TIMETABLE_READ,
    Permission.TIMETABLE_UPDATE,
    Permission.TIMETABLE_CREATE,
  ], 'school', actor.schoolId)) {
    return
  }

  for (const sessionId of sessionIds) {
    const canAccessSession = actorGrantCoversAny(actor, [
      Permission.ATTENDANCE_RECORD,
      Permission.GRADE_INPUT,
      Permission.CLASS_LOGBOOK_CREATE,
      Permission.CLASS_LOGBOOK_UPDATE,
      Permission.DISCIPLINE_CREATE,
    ], 'session', sessionId)

    if (canAccessSession) {
      continue
    }

    const session = await repos.sessions.findById(sessionId)
    if (!session) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    await checkClassGroupAccess(actor, [session.classGroupId], repos)
  }
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
