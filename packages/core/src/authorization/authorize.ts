import type { ActorMetadata } from './actor-metadata'
import type { AuthorizationRequest } from './authorization-request'
import { scopeGrantCovers } from '../ports/authorization-repository'
import { isInteractiveActor } from './actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from './authorization-error'
import { assertPermissionAssurance } from './permissions/permission-assurance'
import { permissionDefinitions } from './permissions/permission-definitions'
import { assertPortalPermission } from './portal-permissions'

export interface AuthorizeArgs {
  actor: ActorMetadata
  request: AuthorizationRequest
}

/**
 * Permission-based authorization entry point.
 *
 * Uses preloaded effective grants on the actor.
 *
 * Resource-level checks remain on `AuthorizationPolicy` resolvers at call sites.
 */
export function authorize(args: AuthorizeArgs): void {
  const { actor, request } = args

  assertActorSchool(actor, request.schoolId)
  assertScopeCompatibleWithPermission(request)
  assertGrantsCapability(actor, request)
}

function assertActorSchool(actor: ActorMetadata, schoolId: string): void {
  if (actor.kind === 'system') {
    if (actor.schoolId !== schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    return
  }

  if (actor.schoolId !== schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

function assertScopeCompatibleWithPermission(request: AuthorizationRequest): void {
  const definition = permissionDefinitions[request.permission]

  if (request.scopeType && !definition.allowedScopes.includes(request.scopeType)) {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      `Scope type "${request.scopeType}" is not allowed for permission "${request.permission}"`,
    )
  }

  if (request.scopeEntityId && !request.scopeType) {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      'scopeEntityId requires scopeType',
    )
  }
}

function assertGrantsCapability(
  actor: ActorMetadata,
  request: AuthorizationRequest,
): void {
  if (actor.kind === 'system') {
    return
  }

  if (!isInteractiveActor(actor)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  assertPermissionAssurance(actor.assuranceLevel, request.permission)

  if (actor.kind === 'guardian' || actor.kind === 'student') {
    assertPortalPermission(actor, request.permission)
    return
  }

  const grants = actor.effectiveGrants

  if (!grants.permissions.has(request.permission)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (!scopeGrantCovers(grants.scopeGrants, {
    permission: request.permission,
    schoolId: request.schoolId,
    scopeType: request.scopeType,
    scopeEntityId: request.scopeEntityId,
    isElevated: grants.isElevated,
  })) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
