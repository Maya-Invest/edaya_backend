import { beforeEach, describe, expect, it, mock } from "bun:test";
import { apiAuthCacheInvalidationPort } from "@/lib/authorization/auth-cache-invalidation-port";
import {
  resetEffectiveGrantsCacheStore,
  resolveCachedEffectiveGrants,
} from "@/lib/authorization/grants-cache/resolve-cached";
import {
  resetActorScopeCacheStore,
  resolveCachedActorScope,
} from "@/lib/authorization/scope-cache/resolve-cached";
import { getActorScopeCacheStore } from "@/lib/authorization/scope-cache/store";

describe("apiAuthCacheInvalidationPort", () => {
  beforeEach(() => {
    resetEffectiveGrantsCacheStore();
    resetActorScopeCacheStore();
  });

  it("invalidates the actual guardian and student scope stores", () => {
    const store = getActorScopeCacheStore();
    store.set("guardian", {
      actorScope: "school-1:guardian:guardian-1",
      generation: store.getGeneration(),
      expiresAt: Date.now() + 60_000,
      scope: { studentIds: ["student-1"], classGroupIds: [] },
    });
    store.set("student", {
      actorScope: "school-1:student:student-1",
      generation: store.getGeneration(),
      expiresAt: Date.now() + 60_000,
      scope: { studentId: "student-1" },
    });
    apiAuthCacheInvalidationPort.invalidateForEvent({ kind: "guardian-scope", guardianId: "guardian-1", schoolId: "school-1" });
    expect(store.get("guardian")).toBeUndefined();
    expect(store.get("student")).toBeDefined();
    apiAuthCacheInvalidationPort.invalidateForEvent({ kind: "student-scope", studentId: "student-1", schoolId: "school-1" });
    expect(store.get("student")).toBeUndefined();
  });

  it("ignores existing cached authority when cross-request caching is disabled", async () => {
    const resolveActorGrants = mock(async () => ({ permissions: new Set<string>(), scopeGrants: [], isElevated: false }));
    const args = {
      actorId: "staff-1",
      actorType: "staff" as const,
      schoolId: "school-1",
      subjectId: "subject-1",
      authenticatedAt: new Date(),
      repositories: { authorization: { resolveActorGrants } } as never,
    };
    await resolveCachedEffectiveGrants({ ...args, ttlMs: 60_000 });
    await resolveCachedEffectiveGrants(args);
    await resolveCachedEffectiveGrants(args);
    expect(resolveActorGrants).toHaveBeenCalledTimes(3);
  });

  it("invalidates cached staff grants after staff-grants events", async () => {
    const resolveActorGrants = mock(async () => ({
      permissions: new Set<string>(),
      scopeGrants: [],
      isElevated: false,
    }));
    const repositories = { authorization: { resolveActorGrants } } as never;
    const args = {
      actorId: "staff-1",
      actorType: "staff" as const,
      schoolId: "school-1",
      subjectId: "auth-subject",
      sessionId: "session-1",
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
      repositories,
      now: new Date("2026-01-01T00:00:00.000Z"),
    };

    await resolveCachedEffectiveGrants(args);
    apiAuthCacheInvalidationPort.invalidateForEvent({
      kind: "staff-grants",
      staffMemberId: "staff-1",
      schoolId: "school-1",
    });
    await resolveCachedEffectiveGrants(args);

    expect(resolveActorGrants).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached guardian and student grants after scope events", async () => {
    const resolveActorGrants = mock(async () => ({
      permissions: new Set<string>(),
      scopeGrants: [],
      isElevated: false,
    }));
    const repositories = { authorization: { resolveActorGrants } } as never;
    const guardianArgs = {
      actorId: "guardian-1",
      actorType: "guardian" as const,
      schoolId: "school-1",
      subjectId: "auth-guardian",
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
      repositories,
      now: new Date("2026-01-01T00:00:00.000Z"),
    };

    await resolveCachedEffectiveGrants(guardianArgs);
    apiAuthCacheInvalidationPort.invalidateForEvent({
      kind: "guardian-scope",
      guardianId: "guardian-1",
      schoolId: "school-1",
    });
    await resolveCachedEffectiveGrants(guardianArgs);

    const studentArgs = {
      ...guardianArgs,
      actorId: "student-1",
      actorType: "student" as const,
      subjectId: "auth-student",
    };
    resolveActorGrants.mockClear();
    await resolveCachedEffectiveGrants(studentArgs);
    apiAuthCacheInvalidationPort.invalidateForEvent({
      kind: "student-scope",
      studentId: "student-1",
      schoolId: "school-1",
    });
    await resolveCachedEffectiveGrants(studentArgs);

    expect(resolveActorGrants).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached teacher scope after teacher-scope events", async () => {
    const findById = mock(async () => ({ id: "teacher-1", schoolId: "school-1", isActive: true }));
    const repositories = {
      teachers: { findById },
      teacherAssignments: {
        list: mock(async () => []),
      },
      academicYears: {
        findOne: mock(async () => undefined),
      },
    };
    const args = {
      actorId: "teacher-1",
      actorKind: "teacher" as const,
      schoolId: "school-1",
      subjectId: "auth-teacher",
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
      repositories: repositories as never,
      now: new Date("2026-01-01T00:00:00.000Z"),
    };

    await resolveCachedActorScope(args);
    apiAuthCacheInvalidationPort.invalidateForEvent({
      kind: "teacher-scope",
      teacherId: "teacher-1",
      schoolId: "school-1",
    });
    await resolveCachedActorScope(args);

    expect(findById).toHaveBeenCalledTimes(2);
  });
});
