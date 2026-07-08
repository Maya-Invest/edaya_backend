import { beforeEach, describe, expect, it, mock } from "bun:test";
import { EMPTY_GUARDIAN_SCOPE } from "@edaya/authorization";
import {
  InMemoryActorScopeCacheStore,
  resetActorScopeCacheStore,
  setActorScopeCacheStore,
} from "@/lib/authorization/scope-cache/store";
import {
  invalidateActorScopeCacheForActor,
  resolveCachedActorScope,
  resolveScopeCacheTtlMs,
} from "@/lib/authorization/scope-cache/resolve-cached";

describe("actor scope cache store", () => {
  beforeEach(() => {
    resetActorScopeCacheStore();
  });

  it("returns cached scope entries until they expire", async () => {
    const findById = mock(async () => ({ id: "guardian-1", schoolId: "school-1" }));
    const repositories = {
      guardians: { findById },
      guardianLinks: {
        list: mock(async () => []),
      },
    };
    const args = {
      actorId: "guardian-1",
      actorKind: "guardian" as const,
      schoolId: "school-1",
      subjectId: "auth-guardian",
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
      repositories: repositories as never,
      now: new Date("2026-01-01T00:00:00.000Z"),
      ttlMs: 60_000,
    };

    await resolveCachedActorScope(args);
    await resolveCachedActorScope(args);

    expect(findById).toHaveBeenCalledTimes(1);
  });

  it("drops stale entries when the cache generation is bumped", () => {
    const store = new InMemoryActorScopeCacheStore();
    setActorScopeCacheStore(store);

    store.set("scope-key", {
      scope: EMPTY_GUARDIAN_SCOPE,
      actorScope: "school-1:guardian:guardian-1",
      generation: store.getGeneration(),
      expiresAt: Date.now() + 60_000,
    });
    store.bumpGeneration();

    expect(store.get("scope-key")).toBeUndefined();
  });

  it("deletes cached entries for a specific actor scope", async () => {
    const findById = mock(async () => ({ id: "guardian-1", schoolId: "school-1" }));
    const repositories = {
      guardians: { findById },
      guardianLinks: {
        list: mock(async () => []),
      },
    };
    const args = {
      actorId: "guardian-1",
      actorKind: "guardian" as const,
      schoolId: "school-1",
      subjectId: "auth-guardian",
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
      repositories: repositories as never,
      now: new Date("2026-01-01T00:00:00.000Z"),
    };

    await resolveCachedActorScope(args);
    invalidateActorScopeCacheForActor("guardian-1", "guardian", "school-1");
    await resolveCachedActorScope(args);

    expect(findById).toHaveBeenCalledTimes(2);
  });

  it("uses the configured grants cache ttl when present", () => {
    expect(resolveScopeCacheTtlMs({ GRANTS_CACHE_TTL_MS: 120_000 })).toBe(120_000);
    expect(resolveScopeCacheTtlMs()).toBe(300_000);
  });
});
