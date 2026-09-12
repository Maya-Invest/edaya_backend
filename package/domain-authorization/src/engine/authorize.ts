import type { ActorMetadata } from '../model/actor'
import type { AuthorizationRequest } from '../model/request'
import { effectiveGrantsForActor } from '../grants/effective-grants-for-actor'
import { scopeGrantCovers } from '../grants/scope-grant-covers'
import { isInteractiveActor, isSchoolScopedActor } from '../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { assertHumanOnlyPermission, assertPermissionAssurance } from '../permissions/permission-assurance'
import { permissionDefinitions } from '../permissions/permission-definitions'
import { requestScopeAllowedForCatalogScope } from '../scope/scope-request-compat'

export interface AuthorizeArgs {
  actor: ActorMetadata
  request: AuthorizationRequest
}

/**
 * Permission-based authorization entry point (staff-only).
 *
 * Portal actors must use relationship capability gates (`assertCapability`).
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
  if (!isSchoolScopedActor(actor) || actor.schoolId !== schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

function assertScopeCompatibleWithPermission(request: AuthorizationRequest): void {
  const definition = permissionDefinitions[request.permission]

  if (request.scopeEntityId && !request.scopeType) {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      'scopeEntityId requires scopeType',
    )
  }

  if (!request.scopeType) {
    return
  }

  if (!requestScopeAllowedForCatalogScope(definition.scope, request.scopeType)) {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      `Scope type "${request.scopeType}" is not allowed for permission "${request.permission}"`,
    )
  }
}

function assertGrantsCapability(
  actor: ActorMetadata,
  request: AuthorizationRequest,
): void {
  if (!isInteractiveActor(actor)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (actor.kind !== 'staff') {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      'authorize() is staff-only; portal actors must use assertCapability()',
    )
  }

  const grants = effectiveGrantsForActor(actor)

  assertPermissionAssurance(
    actor.assuranceLevel,
    request.permission,
    actor.kind === 'staff' ? actor.accountKind : 'human',
    grants.isElevated,
  )

  if (actor.kind === 'staff') {
    assertHumanOnlyPermission(
      actor.accountKind,
      request.permission,
      grants.isElevated,
    )
  }

  if (!grants.permissions.has(request.permission)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (!scopeGrantCovers(grants, {
    permission: request.permission,
    schoolId: request.schoolId,
    scopeType: request.scopeType,
    scopeEntityId: request.scopeEntityId,
    isElevated: grants.isElevated,
  })) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
