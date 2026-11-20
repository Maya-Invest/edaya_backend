import type { StaffAccountKind } from '@edaya/core'
import { corePermissionDefinition } from '@edaya/core'
import { ActorAssuranceLevel } from '../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { Permission } from './permission'

/** Minimum interactive actor assurance required before a permission is allowed. */
export const PERMISSION_ASSURANCE: Readonly<Record<Permission, ActorAssuranceLevel>> = Object.fromEntries(Object.values(Permission).map(permission => [permission, corePermissionDefinition(permission).minimumAssurance])) as Record<Permission, ActorAssuranceLevel>

const HUMAN_ASSURANCE_RANK: Record<
  Exclude<ActorAssuranceLevel, ActorAssuranceLevel.Service>,
  number
> = {
  [ActorAssuranceLevel.Standard]: 0,
  [ActorAssuranceLevel.Verified]: 1,
  [ActorAssuranceLevel.Strong]: 2,
}

/** Permissions that only human staff may exercise (not service accounts). */
export const HUMAN_ONLY_PERMISSIONS = new Set(Object.values(Permission).filter(permission => corePermissionDefinition(permission).humanOnly))

/** Permissions that elevated school owners may manage without verified step-up. */
const ELEVATED_SERVICE_ACCOUNT_MANAGEMENT = new Set<Permission>([
  Permission.SERVICE_ACCOUNT_READ,
  Permission.SERVICE_ACCOUNT_MANAGE,
  Permission.SERVICE_ACCOUNT_MANAGE,
  Permission.SERVICE_ACCOUNT_MANAGE,
  Permission.SERVICE_ACCOUNT_MANAGE,
])

export function assertPermissionAssurance(
  assuranceLevel: ActorAssuranceLevel | undefined,
  permission: Permission,
  accountKind: StaffAccountKind = 'human',
  isElevated = false,
): void {
  if (accountKind === 'service') {
    return
  }

  if (assuranceLevel === ActorAssuranceLevel.Service) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (isElevated && ELEVATED_SERVICE_ACCOUNT_MANAGEMENT.has(permission)) {
    return
  }

  const required = PERMISSION_ASSURANCE[permission]
  if (!required || required === ActorAssuranceLevel.Service) {
    return
  }

  const actorLevel = assuranceLevel ?? ActorAssuranceLevel.Standard
  if (HUMAN_ASSURANCE_RANK[actorLevel] < HUMAN_ASSURANCE_RANK[required]) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

/** Permissions that elevated owner service accounts may use for integrations (e.g. seeding). */
const ELEVATED_SERVICE_OPERATIONAL_PERMISSIONS = new Set<Permission>([
  Permission.ACCESS_CONTROL_MANAGE,
  Permission.ACCESS_CONTROL_MANAGE,
  Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE,
])

export function assertHumanOnlyPermission(
  accountKind: StaffAccountKind,
  permission: Permission,
  isElevated = false,
): void {
  if (accountKind !== 'service' || !HUMAN_ONLY_PERMISSIONS.has(permission)) {
    return
  }

  if (isElevated && ELEVATED_SERVICE_OPERATIONAL_PERMISSIONS.has(permission)) {
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
