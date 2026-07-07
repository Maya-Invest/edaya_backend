import type { SchoolRepositories } from '../../../../../ports/repositories/school-repositories'
import type { GuardianActorMetadata } from '../../../model/actor'
import { portalFeeCatalogAccess } from './portal-catalog'

export async function guardianFeeCatalogAccess(
  actor: GuardianActorMetadata,
  feeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  await portalFeeCatalogAccess(actor, feeIds, repos)
}
