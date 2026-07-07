import type { ActorMetadata } from '../../model/actor'
import { actorHasAnyPermission } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { Permission } from '../../permissions/permission'

export async function checkStaffAssignmentAccess(
  actor: ActorMetadata,
  assignments: readonly { staffId: string }[],
): Promise<void> {
  if (actor.kind === 'system') {
    return
  }

  for (const assignment of assignments) {
    if (actor.kind === 'staff' && actor.staffMemberId === assignment.staffId) {
      continue
    }
    if (!actorHasAnyPermission(actor, [Permission.SCHOOL_STRUCTURE_CONFIGURE])) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Staff assignment read denied')
    }
  }
}
