import type { AuthorizationRepositories } from '@edaya/authorization'
import type { StudentActorMetadata } from '../../../model/actor'
import { portalFeeCatalogAccess } from './portal-catalog'

export async function studentSelfFeeCatalogAccess(
  actor: StudentActorMetadata,
  feeIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await portalFeeCatalogAccess(actor, feeIds, repos)
}
