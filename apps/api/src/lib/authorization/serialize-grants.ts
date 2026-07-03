import type { EffectiveGrants, InteractiveActorMetadata, Permission, ScopeGrant } from "@edaya/core";
import {
  isInteractiveActor,
  legacyScopeGrantsFromScopeIdsByPermission,
  mergeScopeGrants,
} from "@edaya/core";

export interface SerializedEffectiveGrants {
  permissions: string[];
  scopeGrants: ScopeGrant[];
  scopeIdsByPermission: Record<string, string>;
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

function serializeScopeIdsByPermission(
  scopeIdsByPermission: EffectiveGrants["scopeIdsByPermission"],
): Record<string, string> {
  if (!scopeIdsByPermission) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(scopeIdsByPermission).filter(
      (entry): entry is [Permission, string] => entry[1] !== undefined,
    ),
  );
}

export function serializeEffectiveGrants(grants: EffectiveGrants): SerializedEffectiveGrants {
  const scopeGrants = mergeScopeGrants([
    ...grants.scopeGrants,
    ...legacyScopeGrantsFromScopeIdsByPermission(grants.scopeIdsByPermission),
  ]);

  return {
    permissions: [...grants.permissions],
    scopeGrants: scopeGrants.map(({ permission, scopeType, scopeEntityIds }) => ({
      permission,
      scopeType,
      scopeEntityIds: [...scopeEntityIds],
    })),
    scopeIdsByPermission: serializeScopeIdsByPermission(grants.scopeIdsByPermission),
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
