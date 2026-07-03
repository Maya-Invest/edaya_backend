import type { ActorMetadata } from '../model/actor'
import type { Permission } from '../permissions/permission'
import type { AuthorizationScopeType } from '../permissions/scope-type'
import { isInteractiveActor } from '../model/actor'
import { permissionDefinitions } from '../permissions/permission-definitions'
import { scopePathCovers } from '../scope/scope-path-covers'
import { scopeGrantCovers } from './scope-grant-covers'

export function actorHasAnyPermission(
  actor: ActorMetadata,
  permissions: readonly Permission[],
): boolean {
  if (!isInteractiveActor(actor)) {
    return false
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
  scopeType: AuthorizationScopeType,
  scopeEntityId: string,
): boolean {
  if (!isInteractiveActor(actor)) {
    return false
  }

  const grants = actor.effectiveGrants
  if (!grants) {
    return false
  }

  return permissions.some(permission =>
    grants.permissions.has(permission)
    && scopeGrantCovers(grants, {
      permission,
      schoolId: actor.schoolId,
      scopeType,
      scopeEntityId,
      isElevated: grants.isElevated,
    }))
}

export function actorGrantCoversResourcePath(
  actor: ActorMetadata,
  permission: Permission,
  resourcePath: string,
): boolean {
  if (!isInteractiveActor(actor)) {
    return false
  }

  const grants = actor.effectiveGrants
  if (!grants?.permissions.has(permission)) {
    return false
  }

  if (grants.isElevated) {
    return true
  }

  const scopeIds = grants.scopeIdsByPermission?.[permission]
  if (scopeIds !== undefined) {
    return scopePathCovers(scopeIds, resourcePath, permissionDefinitions[permission].scope)
  }

  return scopeGrantCovers(grants, {
    permission,
    schoolId: actor.schoolId,
    scopeEntityId: resourcePath.split(':').at(-1) ?? resourcePath,
    scopeType: resourcePath.includes(':') ? 'class_subject' : 'class_group',
    isElevated: false,
  })
}

export function actorGrantCoversAnyResourcePath(
  actor: ActorMetadata,
  permissions: readonly Permission[],
  resourcePath: string,
): boolean {
  return permissions.some(permission =>
    actorGrantCoversResourcePath(actor, permission, resourcePath))
}

/** Elevated staff, tenant-wide grants, or legacy school-wide scope grants. */
export function actorHasSchoolWideGrant(
  actor: ActorMetadata,
  permissions: readonly Permission[],
): boolean {
  if (!isInteractiveActor(actor)) {
    return false
  }

  const grants = actor.effectiveGrants
  if (!grants) {
    return false
  }

  if (grants.isElevated) {
    return true
  }

  return permissions.some(permission =>
    scopeGrantCovers(grants, {
      permission,
      schoolId: actor.schoolId,
      scopeType: 'school',
      scopeEntityId: actor.schoolId,
      isElevated: false,
    }))
}
