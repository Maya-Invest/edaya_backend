import {
  type EffectiveGrants,
  resolveEffectiveGrants,
  type SchoolRepositories,
} from "@edaya/core";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  grants: EffectiveGrants;
  expiresAt: number;
  staffScope: string;
}

export interface ResolveCachedEffectiveGrantsArgs {
  staffMemberId: string;
  schoolId: string;
  subjectId: string;
  sessionId?: string;
  authenticatedAt: Date;
  repositories: SchoolRepositories;
  now?: Date;
  ttlMs?: number;
}

const entries = new Map<string, CacheEntry>();
const staffIndex = new Map<string, Set<string>>();

export async function resolveCachedEffectiveGrants({
  staffMemberId,
  schoolId,
  subjectId,
  sessionId,
  authenticatedAt,
  repositories,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
}: ResolveCachedEffectiveGrantsArgs): Promise<EffectiveGrants> {
  const key = cacheKey({ schoolId, staffMemberId, subjectId, sessionId, authenticatedAt });
  const existing = entries.get(key);
  if (existing && existing.expiresAt > now.getTime()) {
    return existing.grants;
  }

  if (existing) {
    deleteEntry(key, existing.staffScope);
  }

  const grants = await resolveEffectiveGrants({
    staffMemberId,
    schoolId,
    repositories,
    now,
  });
  const staffScope = staffCacheScope(schoolId, staffMemberId);
  const ttlExpiresAt = now.getTime() + ttlMs;
  const grantExpiresAt = grants.expiresAt?.getTime();
  entries.set(key, {
    grants,
    staffScope,
    expiresAt: grantExpiresAt === undefined ? ttlExpiresAt : Math.min(ttlExpiresAt, grantExpiresAt),
  });
  indexEntry(staffScope, key);
  return grants;
}

export function invalidateEffectiveGrantsCacheForStaff(staffMemberId: string, schoolId?: string): void {
  const scopeSuffix = `:${staffMemberId}`;
  for (const staffScope of [...staffIndex.keys()]) {
    if (schoolId && staffScope !== staffCacheScope(schoolId, staffMemberId)) {
      continue;
    }
    if (!schoolId && !staffScope.endsWith(scopeSuffix)) {
      continue;
    }

    for (const key of staffIndex.get(staffScope) ?? []) {
      entries.delete(key);
    }
    staffIndex.delete(staffScope);
  }
}

export function clearEffectiveGrantsCache(): void {
  entries.clear();
  staffIndex.clear();
}

function indexEntry(staffScope: string, key: string): void {
  const keys = staffIndex.get(staffScope) ?? new Set<string>();
  keys.add(key);
  staffIndex.set(staffScope, keys);
}

function deleteEntry(key: string, staffScope: string): void {
  entries.delete(key);
  const keys = staffIndex.get(staffScope);
  if (!keys) {
    return;
  }
  keys.delete(key);
  if (keys.size === 0) {
    staffIndex.delete(staffScope);
  }
}

function staffCacheScope(schoolId: string, staffMemberId: string): string {
  return `${schoolId}:${staffMemberId}`;
}

function cacheKey({
  schoolId,
  staffMemberId,
  subjectId,
  sessionId,
  authenticatedAt,
}: {
  schoolId: string;
  staffMemberId: string;
  subjectId: string;
  sessionId?: string;
  authenticatedAt: Date;
}): string {
  const sessionScope = sessionId
    ? `session:${sessionId}`
    : `auth:${subjectId}:${authenticatedAt.toISOString()}`;
  return `${schoolId}:${staffMemberId}:${sessionScope}`;
}
