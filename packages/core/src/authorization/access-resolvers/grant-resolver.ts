import type { ActorMetadata } from '../actor-metadata'
import type { Permission } from '../permissions'
import type { ScopeType } from '../permissions/scope-type'
import { scopeGrantCovers } from '../../ports/authorization-repository'

export function actorHasAnyPermission(
  actor: ActorMetadata,
  permissions: readonly Permission[],
): boolean {
  if (actor.kind === 'system') {
    return true
  }

  const grants = actor.effectiveGrants
  if (!grants) {
    return false
  }

  if (permissions.length === 0) {
    return grants.isElevated || grants.permissions.size > 0
  }

  return grants.isElevated || permissions.some(permission => grants.permissions.has(permission))
}

export function actorGrantCoversAny(
  actor: ActorMetadata,
  permissions: readonly Permission[],
  scopeType: ScopeType,
  scopeEntityId: string,
): boolean {
  if (actor.kind === 'system') {
    return true
  }

  const grants = actor.effectiveGrants
  if (!grants) {
    return false
  }

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
