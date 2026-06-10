import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import type { SchoolModule } from '../../model/school-module'
import { actorHasAnyPermission } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { PORTAL_ACCESSIBLE_MODULES } from '../../model/school-module'

export async function checkModuleAccess(
  actor: ActorMetadata,
  schoolId: string,
  module: SchoolModule,
  _repos: SchoolRepositories,
): Promise<void> {
  if (actor.kind === 'system') {
    return
  }

  if (actor.schoolId !== schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (actor.kind === 'guardian' || actor.kind === 'student') {
    if (PORTAL_ACCESSIBLE_MODULES.has(module)) {
      return
    }
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (!actorHasAnyPermission(actor, [])) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
