import type {
  EffectiveGrants,
  SchoolRepositories,
} from "@edaya/core";
import {
  getEffectiveGrantsCacheStore,
  resetEffectiveGrantsCacheStore,
} from "@/lib/authorization/grants-cache/store";
import type { Environment } from "@/runtime";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export interface ResolveCachedEffectiveGrantsArgs {
  actorId?: string;
  actorType?: "staff" | "guardian" | "student";
  staffMemberId?: string;
  schoolId: string;
  academicYearId?: string;
  subjectId: string;
  sessionId?: string;
  authenticatedAt: Date;
  repositories: SchoolRepositories;
  now?: Date;
  ttlMs?: number;
}

export function resolveGrantsCacheTtlMs(env?: Pick<Environment, "GRANTS_CACHE_TTL_MS">): number {
  return env?.GRANTS_CACHE_TTL_MS ?? DEFAULT_TTL_MS;
}

export async function resolveCachedEffectiveGrants({
  actorId,
  actorType = "staff",
  staffMemberId,
  schoolId,
  academicYearId,
  subjectId,
  sessionId,
  authenticatedAt,
  repositories,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
}: ResolveCachedEffectiveGrantsArgs): Promise<EffectiveGrants> {
  const finalActorId = actorId ?? staffMemberId;
  if (!finalActorId) {
    throw new Error("actorId or staffMemberId is required");
  }

  const store = getEffectiveGrantsCacheStore();
  const key = cacheKey({
    schoolId,
    actorId: finalActorId,
    actorType,
    academicYearId,
    subjectId,
    sessionId,
    authenticatedAt,
  });
  const existing = store.get(key);
  if (existing && existing.expiresAt > now.getTime()) {
    return existing.grants;
  }

  const actorScope = actorCacheScope(schoolId, finalActorId, actorType);

  if (existing) {
    store.delete(key);
  }

  const grants = await repositories.authorization.resolveActorGrants({
    actorId: finalActorId,
    actorType,
    schoolId,
    ...(academicYearId ? { academicYearId } : {}),
    now,
  });

  const ttlExpiresAt = now.getTime() + ttlMs;
  const grantExpiresAt = grants.expiresAt?.getTime();
  store.set(key, {
    grants,
    actorScope,
    generation: store.getGeneration(),
    expiresAt: grantExpiresAt === undefined ? ttlExpiresAt : Math.min(ttlExpiresAt, grantExpiresAt),
  });
  return grants;
}

export function invalidateEffectiveGrantsCacheForActor(actorId: string, actorType: "staff" | "guardian" | "student", schoolId?: string): void {
  getEffectiveGrantsCacheStore().deleteForActor(actorId, actorType, schoolId);
}

export function invalidateEffectiveGrantsCacheForStaff(staffMemberId: string, schoolId?: string): void {
  invalidateEffectiveGrantsCacheForActor(staffMemberId, "staff", schoolId);
}

export function clearEffectiveGrantsCache(): void {
  getEffectiveGrantsCacheStore().clear();
}

export function getEffectiveGrantsCacheGeneration(): number {
  return getEffectiveGrantsCacheStore().getGeneration();
}

export { resetEffectiveGrantsCacheStore };

function actorCacheScope(schoolId: string, actorId: string, actorType: string): string {
  return `${schoolId}:${actorType}:${actorId}`;
}

function cacheKey({
  schoolId,
  actorId,
  actorType,
  academicYearId,
  subjectId,
  sessionId,
  authenticatedAt,
}: {
  schoolId: string;
  actorId: string;
  actorType: string;
  academicYearId?: string;
  subjectId: string;
  sessionId?: string;
  authenticatedAt: Date;
}): string {
  const sessionScope = sessionId
    ? `session:${sessionId}`
    : `auth:${subjectId}:${authenticatedAt.toISOString()}`;
  const yearScope = academicYearId ?? "all-years";
  return `${schoolId}:${actorType}:${actorId}:${yearScope}:${sessionScope}`;
}
