import type {
  ResolvedActorScope,
  SchoolRepositories,
} from "@edaya/core";
import { resolveActorScope } from "@edaya/core";
import {
  getActorScopeCacheStore,
  resetActorScopeCacheStore,
} from "@/lib/authorization/scope-cache/store";
import type { Environment } from "@/runtime";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export type PortalActorKind = "guardian" | "student" | "teacher";

export interface ResolveCachedActorScopeArgs {
  actorId: string;
  actorKind: PortalActorKind;
  schoolId: string;
  academicYearId?: string;
  subjectId: string;
  sessionId?: string;
  authenticatedAt: Date;
  repositories: SchoolRepositories;
  now?: Date;
  ttlMs?: number;
}

export function resolveScopeCacheTtlMs(env?: Pick<Environment, "GRANTS_CACHE_TTL_MS">): number {
  return env?.GRANTS_CACHE_TTL_MS ?? DEFAULT_TTL_MS;
}

export async function resolveCachedActorScope({
  actorId,
  actorKind,
  schoolId,
  academicYearId,
  subjectId,
  sessionId,
  authenticatedAt,
  repositories,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
}: ResolveCachedActorScopeArgs): Promise<ResolvedActorScope> {
  const store = getActorScopeCacheStore();
  const key = cacheKey({
    schoolId,
    actorId,
    actorKind,
    academicYearId,
    subjectId,
    sessionId,
    authenticatedAt,
  });
  const existing = store.get(key);
  if (existing && existing.expiresAt > now.getTime()) {
    return existing.scope;
  }

  const actorScope = actorCacheScope(schoolId, actorId, actorKind);

  if (existing) {
    store.delete(key);
  }

  const scope = await resolveActorScope({
    actorKind,
    actorId,
    schoolId,
    repositories,
    ...(academicYearId ? { academicYearId } : {}),
  });

  store.set(key, {
    scope,
    actorScope,
    generation: store.getGeneration(),
    expiresAt: now.getTime() + ttlMs,
  });
  return scope;
}

export function invalidateActorScopeCacheForActor(
  actorId: string,
  actorKind: PortalActorKind,
  schoolId?: string,
): void {
  getActorScopeCacheStore().deleteForActor(actorId, actorKind, schoolId);
}

export function clearActorScopeCache(): void {
  getActorScopeCacheStore().clear();
}

export function getActorScopeCacheGeneration(): number {
  return getActorScopeCacheStore().getGeneration();
}

export { resetActorScopeCacheStore };

function actorCacheScope(schoolId: string, actorId: string, actorKind: string): string {
  return `${schoolId}:${actorKind}:${actorId}`;
}

function cacheKey({
  schoolId,
  actorId,
  actorKind,
  academicYearId,
  subjectId,
  sessionId,
  authenticatedAt,
}: {
  schoolId: string;
  actorId: string;
  actorKind: string;
  academicYearId?: string;
  subjectId: string;
  sessionId?: string;
  authenticatedAt: Date;
}): string {
  const sessionScope = sessionId
    ? `session:${sessionId}`
    : `auth:${subjectId}:${authenticatedAt.toISOString()}`;
  const yearScope = academicYearId ?? "all-years";
  return `${schoolId}:${actorKind}:${actorId}:${yearScope}:${sessionScope}`;
}
