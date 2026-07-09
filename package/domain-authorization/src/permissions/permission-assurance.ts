import type { StaffAccountKind } from '@edaya/core'
import { ActorAssuranceLevel } from '../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { Permission } from './permission'

/** Minimum interactive actor assurance required before a permission is allowed. */
export const PERMISSION_ASSURANCE: Partial<Record<Permission, ActorAssuranceLevel>> = {
  [Permission.PLATFORM_REGISTER_SCHOOL]: ActorAssuranceLevel.Strong,
  [Permission.SCHOOL_LIFECYCLE_MANAGE]: ActorAssuranceLevel.Verified,
  [Permission.FINANCIAL_CONFIG_CONFIGURE]: ActorAssuranceLevel.Verified,
  [Permission.FINANCIAL_CONFIG_UPDATE]: ActorAssuranceLevel.Verified,
  [Permission.PAYMENT_CANCEL]: ActorAssuranceLevel.Verified,
  [Permission.PAYMENT_RECORD]: ActorAssuranceLevel.Verified,
  [Permission.PAYMENT_REVERSE]: ActorAssuranceLevel.Verified,
  [Permission.REPORT_CARD_PUBLISH]: ActorAssuranceLevel.Verified,
  [Permission.STUDENT_UPDATE]: ActorAssuranceLevel.Verified,
  [Permission.STUDENT_HEALTH_UPDATE]: ActorAssuranceLevel.Verified,
  [Permission.DISCIPLINE_VALIDATE]: ActorAssuranceLevel.Verified,
  [Permission.SERVICE_ACCOUNT_CREATE]: ActorAssuranceLevel.Verified,
  [Permission.SERVICE_ACCOUNT_UPDATE]: ActorAssuranceLevel.Verified,
  [Permission.SERVICE_ACCOUNT_REVOKE]: ActorAssuranceLevel.Verified,
  [Permission.SERVICE_ACCOUNT_ROTATE_KEY]: ActorAssuranceLevel.Verified,
}

const HUMAN_ASSURANCE_RANK: Record<
  Exclude<ActorAssuranceLevel, ActorAssuranceLevel.Service>,
  number
> = {
  [ActorAssuranceLevel.Standard]: 0,
  [ActorAssuranceLevel.Verified]: 1,
  [ActorAssuranceLevel.Strong]: 2,
}

/** Permissions that only human staff may exercise (not service accounts). */
export const HUMAN_ONLY_PERMISSIONS = new Set<Permission>([
  Permission.SERVICE_ACCOUNT_READ,
  Permission.SERVICE_ACCOUNT_CREATE,
  Permission.SERVICE_ACCOUNT_UPDATE,
  Permission.SERVICE_ACCOUNT_REVOKE,
  Permission.SERVICE_ACCOUNT_ROTATE_KEY,
  Permission.ACCESS_CONTROL_ASSIGN,
  Permission.ACCESS_CONTROL_CONFIGURE,
  Permission.PLATFORM_REGISTER_SCHOOL,
])

/** Permissions that elevated school owners may manage without verified step-up. */
const ELEVATED_SERVICE_ACCOUNT_MANAGEMENT = new Set<Permission>([
  Permission.SERVICE_ACCOUNT_READ,
  Permission.SERVICE_ACCOUNT_CREATE,
  Permission.SERVICE_ACCOUNT_UPDATE,
  Permission.SERVICE_ACCOUNT_REVOKE,
  Permission.SERVICE_ACCOUNT_ROTATE_KEY,
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
  Permission.ACCESS_CONTROL_ASSIGN,
  Permission.ACCESS_CONTROL_CONFIGURE,
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
