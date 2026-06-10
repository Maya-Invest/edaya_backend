import type { ActorMetadata } from '../model/actor'
import type { AuthorizationRequest } from '../model/request'
import { scopeGrantCovers } from '../../ports/authorization-repository'
import { isInteractiveActor } from '../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { assertPermissionAssurance } from '../permissions/permission-assurance'
import { permissionDefinitions } from '../permissions/permission-definitions'

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
