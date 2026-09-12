import type { AuthorizationRepositories, InteractiveActorMetadata } from "@edaya/authorization";
import { describeActionGrants, isInteractiveActor } from "@edaya/authorization";

export async function serializeActorAuthorization(actor: InteractiveActorMetadata, repositories: AuthorizationRepositories) {
  const grants = await describeActionGrants(actor, repositories);
  return {
    kind: actor.kind,
    actorId: actor.actorId,
    schoolId: actor.schoolId,
    assuranceLevel: actor.assuranceLevel,
    grants: grants.map(({ permission, scopes, academicYearId, startsAt, endsAt, source }) => ({
      permission,
      scopes,
      source,
      ...(academicYearId ? { academicYearId } : {}),
      ...(startsAt ? { startsAt: startsAt.toISOString() } : {}),
      ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
    })),
  };
}

export function requireInteractiveActor(actor: unknown): InteractiveActorMetadata | null {
  return isInteractiveActor(actor) ? actor : null;
}
