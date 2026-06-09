import type {
  EffectiveGrants,
  SchoolRepositories,
} from "@edaya/core";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  grants: EffectiveGrants;
  expiresAt: number;
  actorScope: string;
}

export interface ResolveCachedEffectiveGrantsArgs {
  actorId?: string;
  actorType?: "staff" | "guardian" | "student";
  staffMemberId?: string;
  schoolId: string;
  subjectId: string;
  sessionId?: string;
  authenticatedAt: Date;
  repositories: SchoolRepositories;
  now?: Date;
  ttlMs?: number;
}

const entries = new Map<string, CacheEntry>();
const actorIndex = new Map<string, Set<string>>();

export async function resolveCachedEffectiveGrants({
  actorId,
  actorType = "staff",
  staffMemberId,
  schoolId,
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

  const key = cacheKey({ schoolId, actorId: finalActorId, actorType, subjectId, sessionId, authenticatedAt });
  const existing = entries.get(key);
  if (existing && existing.expiresAt > now.getTime()) {
    return existing.grants;
  }

  const actorScope = actorCacheScope(schoolId, finalActorId, actorType);

  if (existing) {
    deleteEntry(key, existing.actorScope);
  }

  const grants = await repositories.authorization.resolveActorGrants({
    actorId: finalActorId,
    actorType,
    schoolId,
    now,
  });

  const ttlExpiresAt = now.getTime() + ttlMs;
  const grantExpiresAt = grants.expiresAt?.getTime();
  entries.set(key, {
    grants,
    actorScope,
    expiresAt: grantExpiresAt === undefined ? ttlExpiresAt : Math.min(ttlExpiresAt, grantExpiresAt),
  });
  indexEntry(actorScope, key);
  return grants;
}

export function invalidateEffectiveGrantsCacheForActor(actorId: string, actorType: "staff" | "guardian" | "student", schoolId?: string): void {
  const scopeSuffix = `:${actorType}:${actorId}`;
  for (const actorScope of [...actorIndex.keys()]) {
    if (schoolId && actorScope !== actorCacheScope(schoolId, actorId, actorType)) {
      continue;
    }
    if (!schoolId && !actorScope.endsWith(scopeSuffix)) {
      continue;
    }

    for (const key of actorIndex.get(actorScope) ?? []) {
      entries.delete(key);
    }
    actorIndex.delete(actorScope);
  }
}

export function invalidateEffectiveGrantsCacheForStaff(staffMemberId: string, schoolId?: string): void {
  invalidateEffectiveGrantsCacheForActor(staffMemberId, "staff", schoolId);
}

export function clearEffectiveGrantsCache(): void {
  entries.clear();
  actorIndex.clear();
}

function indexEntry(actorScope: string, key: string): void {
  const keys = actorIndex.get(actorScope) ?? new Set<string>();
  keys.add(key);
  actorIndex.set(actorScope, keys);
}

function deleteEntry(key: string, actorScope: string): void {
  entries.delete(key);
  const keys = actorIndex.get(actorScope);
  if (!keys) {
    return;
  }
  keys.delete(key);
  if (keys.size === 0) {
    actorIndex.delete(actorScope);
  }
}

function actorCacheScope(schoolId: string, actorId: string, actorType: string): string {
  return `${schoolId}:${actorType}:${actorId}`;
}

function cacheKey({
  schoolId,
  actorId,
  actorType,
  subjectId,
  sessionId,
  authenticatedAt,
}: {
  schoolId: string;
  actorId: string;
  actorType: string;
  subjectId: string;
  sessionId?: string;
  authenticatedAt: Date;
}): string {
  const sessionScope = sessionId
    ? `session:${sessionId}`
    : `auth:${subjectId}:${authenticatedAt.toISOString()}`;
  return `${schoolId}:${actorType}:${actorId}:${sessionScope}`;
}
