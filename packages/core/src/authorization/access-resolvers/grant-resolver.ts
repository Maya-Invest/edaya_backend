import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import type { Permission } from '../permissions'
import type { ScopeType } from '../permissions/scope-type'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { resolveEffectiveGrants, scopeGrantCovers } from '../effective-grants'

export async function staffHasAnyPermission(
  actor: ActorMetadata,
  permissions: readonly Permission[],
  repos: SchoolRepositories,
): Promise<boolean> {
  if (actor.kind !== 'staff') {
    return false
  }

  const grants = await loadStaffEffectiveGrants(actor, repos)
  if (permissions.length === 0) {
    return true
  }
  return grants.isElevated || permissions.some(permission => grants.permissions.has(permission))
}

export async function staffGrantCoversAny(
  actor: ActorMetadata,
  permissions: readonly Permission[],
  scopeType: ScopeType,
  scopeEntityId: string,
  repos: SchoolRepositories,
): Promise<boolean> {
  if (actor.kind !== 'staff') {
    return false
  }

  const grants = await loadStaffEffectiveGrants(actor, repos)
  return permissions.some(permission =>
    grants.permissions.has(permission)
    && scopeGrantCovers(grants.scopeGrants, {
      permission,
      schoolId: actor.schoolId,
      scopeType,
      scopeEntityId,
      isElevated: grants.isElevated,
    }))
}

async function loadStaffEffectiveGrants(
  actor: Extract<ActorMetadata, { kind: 'staff' }>,
  repos: SchoolRepositories,
) {
  if (actor.effectiveGrants) {
    return actor.effectiveGrants
  }

  try {
    return await resolveEffectiveGrants({
      staffMemberId: actor.staffMemberId,
      schoolId: actor.schoolId,
      repositories: repos,
    })
  }
  catch (error) {
    if (error instanceof AuthorizationError) {
      throw error
    }
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
