import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { staffHasAnyPermission } from './grant-resolver'

export async function checkModuleAccess(
  actor: ActorMetadata,
  schoolId: string,
  module: string,
  repos: SchoolRepositories,
): Promise<void> {
  if (actor.schoolId !== schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  if (actor.kind === 'system')
    return

  if (actor.kind === 'staff') {
    if (!await staffHasAnyPermission(actor, [], repos)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    return
  }

  if (actor.kind === 'guardian' && (module === 'attendance' || module === 'finance' || module === 'academics')) {
    return
  }

  if (actor.kind === 'student' && (module === 'attendance' || module === 'finance' || module === 'academics')) {
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
