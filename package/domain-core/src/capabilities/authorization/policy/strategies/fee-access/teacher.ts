import type { SchoolRepositories } from '../../../../../ports/repositories/school-repositories'
import type { TeacherActorMetadata } from '../../../model/actor'
import { portalFeeCatalogAccess } from './portal-catalog'

export async function teacherFeeCatalogAccess(
  actor: TeacherActorMetadata,
  feeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  await portalFeeCatalogAccess(actor, feeIds, repos)
}
