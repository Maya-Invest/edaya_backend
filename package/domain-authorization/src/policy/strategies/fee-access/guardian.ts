import type { AuthorizationRepositories } from '@edaya/authorization'
import type { GuardianActorMetadata } from '../../../model/actor'
import { portalFeeCatalogAccess } from './portal-catalog'

export async function guardianFeeCatalogAccess(
  actor: GuardianActorMetadata,
  feeIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await portalFeeCatalogAccess(actor, feeIds, repos)
}
