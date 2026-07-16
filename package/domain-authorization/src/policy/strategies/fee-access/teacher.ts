import type { AuthorizationRepositories } from '@edaya/authorization'
import type { TeacherActorMetadata } from '../../../model/actor'
import { portalFeeCatalogAccess } from './portal-catalog'

export async function teacherFeeCatalogAccess(
  actor: TeacherActorMetadata,
  feeIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await portalFeeCatalogAccess(actor, feeIds, repos)
}
