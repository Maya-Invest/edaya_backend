import type { TeacherActorMetadata } from '../model/actor'
import type { TeachingCapability } from './teaching-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

export interface TeachingCapabilityTarget {
  readonly classSubjectId?: string
}

export function assertTeachingCapability(
  actor: TeacherActorMetadata,
  _capability: TeachingCapability,
  target?: TeachingCapabilityTarget,
): void {
  if (!target?.classSubjectId) {
    return
  }

  if (!actor.teacherScope.teaching.classSubjectIds.includes(target.classSubjectId)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export function teacherScopeCoversClassSubject(actor: TeacherActorMetadata, classSubjectId: string): boolean {
  return actor.teacherScope.teaching.classSubjectIds.includes(classSubjectId)
}

export async function teacherCoversClassGroup(
  actor: TeacherActorMetadata,
  classGroupId: string,
  repos: { classSubjects: { findByIds: (ids: readonly string[]) => Promise<Array<{ classGroupId: string }>> } },
): Promise<boolean> {
  if (actor.teacherScope.homeroom.classGroupIds.includes(classGroupId)) {
    return true
  }
  if (actor.teacherScope.teaching.classSubjectIds.length === 0) {
    return false
  }
  const classSubjects = await repos.classSubjects.findByIds(actor.teacherScope.teaching.classSubjectIds)
  return classSubjects.some(classSubject => classSubject.classGroupId === classGroupId)
}
