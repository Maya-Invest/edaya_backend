import type { SchoolRepositories } from '../ports/school-repositories'
import type { ActorMetadata } from './actor-metadata'
import type { AuthorizationPolicy } from './authorization-policy'
import type { AuthorizationRequest } from './authorization-request'
import type { EffectiveGrants } from './effective-grants'
import { isInteractiveActor } from './actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from './authorization-error'
import { resolveEffectiveGrants, scopeGrantCovers } from './effective-grants'
import { assertPermissionAssurance } from './permissions/permission-assurance'
import { permissionDefinitions } from './permissions/permission-definitions'
import { assertPortalPermission } from './portal-permissions'

export interface AuthorizeArgs {
  actor: ActorMetadata
  request: AuthorizationRequest
  policy: AuthorizationPolicy
  repositories?: SchoolRepositories
  effectiveGrants?: EffectiveGrants
}

/**
 * Permission-based authorization entry point.
 *
 * Uses preloaded or persisted effective grants.
 *
 * Resource-level checks remain on `AuthorizationPolicy` resolvers at call sites.
 */
export async function authorize(args: AuthorizeArgs): Promise<void> {
  const { actor, request } = args

  assertActorSchool(actor, request.schoolId)
  assertScopeCompatibleWithPermission(request)
  await assertGrantsCapability(actor, request, args)
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

async function assertGrantsCapability(
  actor: ActorMetadata,
  request: AuthorizationRequest,
  args: AuthorizeArgs,
): Promise<void> {
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

  const grants = await loadEffectiveGrants(actor, request, args)

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

async function loadEffectiveGrants(
  actor: Extract<ActorMetadata, { kind: 'staff' }>,
  request: AuthorizationRequest,
  args: AuthorizeArgs,
): Promise<EffectiveGrants> {
  if (args.effectiveGrants) {
    return args.effectiveGrants
  }

  if (actor.effectiveGrants) {
    return actor.effectiveGrants
  }

  if (!args.repositories) {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      'Staff authorization requires repositories or preloaded effectiveGrants',
    )
  }

  return resolveEffectiveGrants({
    staffMemberId: actor.staffMemberId,
    schoolId: request.schoolId,
    repositories: args.repositories,
    fallbackRoles: actor.roles,
  })
}
