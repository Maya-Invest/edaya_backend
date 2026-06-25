import type { EffectiveGrants, InteractiveActorMetadata, ScopeGrant } from "@edaya/core";
import { isInteractiveActor } from "@edaya/core";

export interface SerializedEffectiveGrants {
  permissions: string[];
  scopeGrants: ScopeGrant[];
  isElevated: boolean;
  expiresAt?: string;
}

export interface SerializedActorAuthorization {
  kind: InteractiveActorMetadata["kind"];
  actorId: string;
  schoolId: string;
  assuranceLevel: InteractiveActorMetadata["assuranceLevel"];
  effectiveGrants: SerializedEffectiveGrants;
}

export function serializeEffectiveGrants(grants: EffectiveGrants): SerializedEffectiveGrants {
  return {
    permissions: [...grants.permissions],
    scopeGrants: grants.scopeGrants.map(({ permission, scopeType, scopeEntityIds }) => ({
      permission,
      scopeType,
      scopeEntityIds: [...scopeEntityIds],
    })),
    isElevated: grants.isElevated,
    ...(grants.expiresAt ? { expiresAt: grants.expiresAt.toISOString() } : {}),
  };
}

export function serializeActorAuthorization(actor: InteractiveActorMetadata): SerializedActorAuthorization {
  return {
    kind: actor.kind,
    actorId: actor.actorId,
    schoolId: actor.schoolId,
    assuranceLevel: actor.assuranceLevel,
    effectiveGrants: serializeEffectiveGrants(actor.effectiveGrants),
  };
}

export function requireInteractiveActor(actor: unknown): InteractiveActorMetadata | null {
  if (!isInteractiveActor(actor)) {
    return null;
  }
  return actor;
}
