import type { ActorMetadata } from '../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

export interface CommandActorKindPolicy {
  readonly serviceOnly?: boolean
}

export function assertCommandActorKind(
  actor: ActorMetadata,
  policy: CommandActorKindPolicy,
): void {
  if (!policy.serviceOnly) {
    return
  }

  if (actor.kind !== 'staff' || actor.accountKind !== 'service') {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      'This command is restricted to service accounts',
    )
  }
}
