import type { ActorMetadata } from '../model/actor'
import type { Permission } from '../permissions/permission'
import type { PortalActorKind } from './portal-permission-sets'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { PORTAL_PERMISSION_POLICIES } from './portal-permission-sets'

export function portalPermissionPolicyFor(actorKind: PortalActorKind) {
  return PORTAL_PERMISSION_POLICIES[actorKind]
}

export function assertPortalPermission(actor: ActorMetadata, permission: Permission): void {
  if (actor.kind !== 'guardian' && actor.kind !== 'student') {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const policy = portalPermissionPolicyFor(actor.kind)
  if (!policy.permissions.has(permission)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
