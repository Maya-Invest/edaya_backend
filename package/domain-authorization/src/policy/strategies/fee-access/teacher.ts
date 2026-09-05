import type { TeacherActorMetadata } from '../../../model/actor'
import type { AuthorizationRepositories } from '../../../ports/authorization-repositories'
import { portalFeeCatalogAccess } from './portal-catalog'

export async function teacherFeeCatalogAccess(
  actor: TeacherActorMetadata,
  feeIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await portalFeeCatalogAccess(actor, feeIds, repos)
}
