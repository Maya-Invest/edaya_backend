import type { SchoolRepositories } from '../../../../../ports/repositories/school-repositories'
import type { StaffActorMetadata } from '../../../model/actor'
import { actorHasSchoolWideGrant } from '../../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'
import { FEE_ACCESS_PERMISSIONS } from '../../resolvers/permission-sets'

export async function staffFeeAccess(
  actor: StaffActorMetadata,
  _feeIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (!actorHasSchoolWideGrant(actor, FEE_ACCESS_PERMISSIONS)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
