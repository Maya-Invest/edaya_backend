import type { SchoolRepositories } from '../../../../../ports/repositories/school-repositories'
import type { StudentActorMetadata } from '../../../model/actor'
import { portalFeeCatalogAccess } from './portal-catalog'

export async function studentSelfFeeCatalogAccess(
  actor: StudentActorMetadata,
  feeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  await portalFeeCatalogAccess(actor, feeIds, repos)
}
