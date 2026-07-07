import type { ActorMetadata } from '../../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { AccessControlOperations } from '../../operations/access-control'
import { assertOperation } from '../../operations/assert-operation'

export async function checkTeacherAssignmentAccess(
  actor: ActorMetadata,
  assignments: readonly { teacherId: string }[],
): Promise<void> {
  if (actor.kind === 'system') {
    return
  }

  for (const assignment of assignments) {
    if (actor.kind === 'teacher' && actor.teacherId === assignment.teacherId) {
      continue
    }

    try {
      assertOperation(actor, AccessControlOperations.assign, undefined, 'module')
    }
    catch (error) {
      if (error instanceof AuthorizationError) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Teacher assignment read denied')
      }
      throw error
    }
  }
}
