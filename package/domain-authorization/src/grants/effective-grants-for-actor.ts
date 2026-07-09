import type { InteractiveActorMetadata } from '../model/actor'
import type { EffectiveGrants } from '../model/effective-grants'
import type { Permission } from '../permissions/permission'

const EMPTY_PORTAL_GRANTS: EffectiveGrants = Object.freeze({
  permissions: new Set<Permission>(),
  scopeGrants: [],
  isElevated: false,
})

/** Staff carries grants on the actor; portal actors use relationship scopes and capability gates. */
export function effectiveGrantsForActor(actor: InteractiveActorMetadata): EffectiveGrants {
  switch (actor.kind) {
    case 'staff':
      return actor.effectiveGrants
    case 'guardian':
    case 'student':
    case 'teacher':
      return EMPTY_PORTAL_GRANTS
  }
}
