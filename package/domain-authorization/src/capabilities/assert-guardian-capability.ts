import type { GuardianActorMetadata } from '../model/actor'
import type { GuardianCapability } from './guardian-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

export interface GuardianCapabilityTarget {
  readonly studentId?: string
  readonly classGroupId?: string
}

/**
 * Relationship-native guardian gate.
 * All linked guardians hold the full read capability set; scope membership is enforced when a target is provided.
 */
export function assertGuardianCapability(
  actor: GuardianActorMetadata,
  _capability: GuardianCapability,
  target?: GuardianCapabilityTarget,
): void {
  if (!target) {
    return
  }

  if (target.studentId && !actor.guardianScope.studentIds.includes(target.studentId)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (target.classGroupId && !actor.guardianScope.classGroupIds.includes(target.classGroupId)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export function guardianScopeCoversStudent(actor: GuardianActorMetadata, studentId: string): boolean {
  return actor.guardianScope.studentIds.includes(studentId)
}

export function guardianScopeCoversClassGroup(actor: GuardianActorMetadata, classGroupId: string): boolean {
  return actor.guardianScope.classGroupIds.includes(classGroupId)
}
