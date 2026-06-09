import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { actorHasAnyPermission } from './grant-resolver'

export async function checkModuleAccess(
  actor: ActorMetadata,
  schoolId: string,
  module: string,
  _repos: SchoolRepositories,
): Promise<void> {
  if (actor.schoolId !== schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  if (actor.kind === 'system') {
    return
  }

  if (actor.kind === 'guardian' || actor.kind === 'student') {
    if (module === 'attendance' || module === 'finance' || module === 'academics') {
      return
    }
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (!actorHasAnyPermission(actor, [])) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
