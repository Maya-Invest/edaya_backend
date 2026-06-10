import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  clearEffectiveGrantsCache,
  getEffectiveGrantsCacheGeneration,
  resetEffectiveGrantsCacheStore,
  resolveCachedEffectiveGrants,
} from "@/lib/authorization/grants-cache/resolve-cached";

describe("effective grants cache store", () => {
  beforeEach(() => {
    resetEffectiveGrantsCacheStore();
  });

  it("bumps generation when the cache is cleared globally", async () => {
    const resolveActorGrants = mock().mockResolvedValue({
      permissions: new Set(),
      scopeGrants: [],
      isElevated: false,
    });
    const repositories = { authorization: { resolveActorGrants } } as any;
    const args = {
      actorId: "staff-1",
      actorType: "staff" as const,
      schoolId: "school-1",
      subjectId: "auth-subject",
      sessionId: "session-1",
      authenticatedAt: new Date("2026-01-01T00:00:00Z"),
      repositories,
    };

    const before = getEffectiveGrantsCacheGeneration();
    await resolveCachedEffectiveGrants(args);
    clearEffectiveGrantsCache();
    const after = getEffectiveGrantsCacheGeneration();

    expect(after).toBeGreaterThan(before);
    await resolveCachedEffectiveGrants(args);
    expect(resolveActorGrants).toHaveBeenCalledTimes(2);
  });
});
