import type { TeacherActorMetadata } from '../model/actor'
import type { HomeroomCapability } from './homeroom-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

export interface HomeroomCapabilityTarget {
  readonly classGroupId?: string
}

export function assertHomeroomCapability(
  actor: TeacherActorMetadata,
  _capability: HomeroomCapability,
  target?: HomeroomCapabilityTarget,
): void {
  if (!target?.classGroupId) {
    return
  }

  if (!actor.teacherScope.homeroom.classGroupIds.includes(target.classGroupId)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export function teacherScopeCoversClassGroup(actor: TeacherActorMetadata, classGroupId: string): boolean {
  return actor.teacherScope.homeroom.classGroupIds.includes(classGroupId)
}
