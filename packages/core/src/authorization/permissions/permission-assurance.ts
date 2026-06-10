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
}

const ASSURANCE_RANK: Record<ActorAssuranceLevel, number> = {
  [ActorAssuranceLevel.Standard]: 0,
  [ActorAssuranceLevel.Verified]: 1,
  [ActorAssuranceLevel.Strong]: 2,
}

export function assertPermissionAssurance(
  assuranceLevel: ActorAssuranceLevel | undefined,
  permission: Permission,
): void {
  const required = PERMISSION_ASSURANCE[permission]
  if (!required) {
    return
  }

  const actorLevel = assuranceLevel ?? ActorAssuranceLevel.Standard
  if (ASSURANCE_RANK[actorLevel] < ASSURANCE_RANK[required]) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
