import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import { actorHasSchoolWideGrant } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { TEACHER_ADMIN_ACCESS_PERMISSIONS } from './permission-sets'

export async function checkTeacherAccess(
  actor: ActorMetadata,
  teacherIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (teacherIds.length === 0) {
    return
  }

  for (const teacherId of teacherIds) {
    const isSelf = actor.kind === 'teacher' && actor.actorId === teacherId
    if (isSelf) {
      continue
    }

    const hasStaffPermission = actorHasSchoolWideGrant(
      actor,
      TEACHER_ADMIN_ACCESS_PERMISSIONS,
    )

    if (!hasStaffPermission) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
