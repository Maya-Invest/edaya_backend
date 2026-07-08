import type { AuthorizationRepositories } from '@edaya/authorization'
import type { ActorMetadata } from '../../../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'
import { guardianFeeCatalogAccess } from './guardian'
import { staffFeeAccess } from './staff'
import { studentSelfFeeCatalogAccess } from './student'
import { teacherFeeCatalogAccess } from './teacher'

export async function dispatchFeeAccess(
  actor: ActorMetadata,
  feeIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  if (feeIds.length === 0) {
    return
  }

  switch (actor.kind) {
    case 'system':
      return
    case 'staff':
      return staffFeeAccess(actor, feeIds, repos)
    case 'guardian':
      return guardianFeeCatalogAccess(actor, feeIds, repos)
    case 'student':
      return studentSelfFeeCatalogAccess(actor, feeIds, repos)
    case 'teacher':
      return teacherFeeCatalogAccess(actor, feeIds, repos)
    default: {
      const _exhaustive: never = actor
      void _exhaustive
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
