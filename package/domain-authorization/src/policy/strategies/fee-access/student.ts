import type { StudentActorMetadata } from '../../../model/actor'
import type { AuthorizationRepositories } from '../../../ports/authorization-repositories'
import { portalFeeCatalogAccess } from './portal-catalog'

export async function studentSelfFeeCatalogAccess(
  actor: StudentActorMetadata,
  feeIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await portalFeeCatalogAccess(actor, feeIds, repos)
}
