import type { EffectiveGrants } from '../model/effective-grants'
import type { ScopeGrant } from '../model/scope-grant'
import type { Permission } from '../permissions/permission'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { Permission as PermissionEnum } from '../permissions/permission'
import {
  type DelegatedPermissionAssignment,
  delegatedPermissionAssignmentSubsetCovers,
} from './permission-assignment-subset'
import { scopeGrantSubsetCovers } from './scope-grant-subset'

export function assertDelegatedPermissionsSubset(
  creatorGrants: EffectiveGrants,
  requestedPermissions: Iterable<Permission>,
): void {
  if (creatorGrants.isElevated) {
    for (const permission of requestedPermissions) {
      if (permission === PermissionEnum.PLATFORM_REGISTER_SCHOOL) {
        throw new AuthorizationError(
          AuthorizationErrorCode.Forbidden,
          'Cannot delegate PLATFORM_REGISTER_SCHOOL to a service account',
        )
      }
    }
    return
  }

  for (const permission of requestedPermissions) {
    if (!creatorGrants.permissions.has(permission)) {
      throw new AuthorizationError(
        AuthorizationErrorCode.Forbidden,
        `Creator lacks permission ${permission}`,
      )
    }
  }
}

export function assertDelegatedScopeGrantsSubset(
  creatorGrants: EffectiveGrants,
  requestedScopeGrants: readonly ScopeGrant[],
  schoolId: string,
): void {
  if (creatorGrants.isElevated) {
    return
  }

  for (const requested of requestedScopeGrants) {
    if (!creatorGrants.permissions.has(requested.permission)) {
      throw new AuthorizationError(
        AuthorizationErrorCode.Forbidden,
        `Creator lacks permission ${requested.permission}`,
      )
    }

    if (!scopeGrantSubsetCovers(creatorGrants, requested, schoolId)) {
      throw new AuthorizationError(
        AuthorizationErrorCode.Forbidden,
        `Creator scope grants do not cover requested scope for ${requested.permission}`,
      )
    }
  }
}

export function assertDelegatedPermissionAssignmentsSubset(
  creatorGrants: EffectiveGrants,
  requestedAssignments: readonly DelegatedPermissionAssignment[],
  schoolId: string,
): void {
  assertDelegatedPermissionsSubset(
    creatorGrants,
    requestedAssignments.map(assignment => assignment.permission),
  )

  if (creatorGrants.isElevated) {
    return
  }

  for (const requested of requestedAssignments) {
    if (!delegatedPermissionAssignmentSubsetCovers(creatorGrants, requested, schoolId)) {
      throw new AuthorizationError(
        AuthorizationErrorCode.Forbidden,
        `Creator grants do not cover requested scope for ${requested.permission}`,
      )
    }
  }
}

export function assertOwnerServiceAccountAllowed(
  creatorGrants: EffectiveGrants,
  elevated: boolean,
): void {
  if (!elevated) {
    return
  }

  if (!creatorGrants.isElevated) {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      'Only elevated staff can create owner-level service accounts',
    )
  }
}
