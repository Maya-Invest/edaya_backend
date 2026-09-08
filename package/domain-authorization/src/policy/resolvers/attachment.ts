import type { ActorMetadata } from '../../model/actor'
import type { AuthorizationRepositories } from '../../ports/authorization-repositories'
import type { AttachmentAccessInput } from '../types'
import { actorHasAnyPermission } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { Permission } from '../../permissions/permission'
import { portalAttachmentAccess } from '../strategies/attachment-access/portal'

export type { AttachmentAccessInput } from '../types'

export async function checkAttachmentAccess(
  actor: ActorMetadata,
  attachments: readonly AttachmentAccessInput[],
  repos: AuthorizationRepositories,
): Promise<void> {
  if (attachments.length === 0) {
    return
  }

  if (actor.kind === 'staff'
    && actorHasAnyPermission(actor, [Permission.ATTACHMENT_READ, Permission.ATTACHMENT_CONFIGURE])) {
    return
  }

  if (actor.kind === 'guardian' || actor.kind === 'student' || actor.kind === 'teacher') {
    await portalAttachmentAccess(actor, attachments, repos)
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
