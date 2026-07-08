import type { EffectiveGrants, InteractiveActorMetadata, Permission, ScopeGrant } from "@edaya/authorization";
import { ALL_GUARDIAN_CAPABILITIES, ALL_HOMEROOM_CAPABILITIES, ALL_STUDENT_CAPABILITIES, ALL_TEACHING_CAPABILITIES, effectiveGrantsForActor, isInteractiveActor } from "@edaya/authorization";

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
  capabilities?: string[];
  scope?: Record<string, unknown>;
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
  return {
    permissions: [...grants.permissions],
    scopeGrants: grants.scopeGrants.map(({ permission, scopeType, scopeEntityIds }) => ({
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
  const base = {
    kind: actor.kind,
    actorId: actor.actorId,
    schoolId: actor.schoolId,
    assuranceLevel: actor.assuranceLevel,
    effectiveGrants: serializeEffectiveGrants(effectiveGrantsForActor(actor)),
  };

  if (actor.kind === "guardian") {
    return {
      ...base,
      capabilities: [...ALL_GUARDIAN_CAPABILITIES],
      scope: {
        studentIds: [...actor.guardianScope.studentIds],
        classGroupIds: [...actor.guardianScope.classGroupIds],
      },
    };
  }

  if (actor.kind === "student") {
    return {
      ...base,
      capabilities: [...ALL_STUDENT_CAPABILITIES],
      scope: {
        studentId: actor.studentScope.studentId,
        ...(actor.studentScope.classGroupId ? { classGroupId: actor.studentScope.classGroupId } : {}),
      },
    };
  }

  if (actor.kind === "teacher") {
    return {
      ...base,
      capabilities: [...ALL_TEACHING_CAPABILITIES, ...ALL_HOMEROOM_CAPABILITIES],
      scope: {
        teaching: {
          classSubjectIds: [...actor.teacherScope.teaching.classSubjectIds],
        },
        homeroom: {
          classGroupIds: [...actor.teacherScope.homeroom.classGroupIds],
        },
      },
    };
  }

  return base;
}

export function requireInteractiveActor(actor: unknown): InteractiveActorMetadata | null {
  if (!isInteractiveActor(actor)) {
    return null;
  }
  return actor;
}
