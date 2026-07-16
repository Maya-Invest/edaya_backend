import type { ActorMetadata } from '../../model/actor'
import { actorHasAnyPermission } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { Permission } from '../../permissions/permission'

export async function checkStaffMemberReadAccess(
  actor: ActorMetadata,
  staffMembers: readonly { id: string }[],
): Promise<void> {
  if (actor.kind === 'system') {
    return
  }

  for (const staffMember of staffMembers) {
    if (actor.kind === 'staff' && actor.staffMemberId === staffMember.id) {
      continue
    }
    if (!actorHasAnyPermission(actor, [
      Permission.SCHOOL_STRUCTURE_CONFIGURE,
      Permission.STAFF_READ,
      Permission.ACCESS_CONTROL_ASSIGN,
    ])) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Staff member read denied')
    }
  }
}
