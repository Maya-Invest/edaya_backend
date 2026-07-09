import type { StudentActorMetadata } from '../model/actor'
import type { StudentCapability } from './student-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

export interface StudentCapabilityTarget {
  readonly studentId?: string
  readonly classGroupId?: string
}

/**
 * Relationship-native student gate.
 * Students hold the full read capability set for self; scope membership is enforced when a target is provided.
 */
export function assertStudentCapability(
  actor: StudentActorMetadata,
  _capability: StudentCapability,
  target?: StudentCapabilityTarget,
): void {
  if (!target) {
    return
  }

  if (target.studentId && actor.studentScope.studentId !== target.studentId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (target.classGroupId && actor.studentScope.classGroupId !== target.classGroupId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export function studentScopeCoversSelf(actor: StudentActorMetadata, studentId: string): boolean {
  return actor.studentScope.studentId === studentId
}

export function studentScopeCoversClassGroup(actor: StudentActorMetadata, classGroupId: string): boolean {
  return actor.studentScope.classGroupId === classGroupId
}
