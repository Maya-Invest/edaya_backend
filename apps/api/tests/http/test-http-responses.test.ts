import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  AuthorizationError,
  AuthorizationErrorCode,
  BusinessRuleViolationError,
  type CoreEntityKey,
  DomainValidationError,
} from "@edaya/core";
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  routeErrorResponse,
} from "@/http/responses";
import {
  clearEffectiveGrantsCache,
  resolveCachedEffectiveGrants,
} from "@/lib/authorization/grants-cache/resolve-cached";
import { getEntityWriteService } from "@/lib/school-api/dispatch/entities";

function createTestContext(): { context: any; json: ReturnType<typeof mock> } {
  const json = mock((body: unknown, status: number) => ({ body, status }));
  const context = {
    json,
    var: { logger: { error: mock() } },
  };
  return { context, json };
}

describe("routeErrorResponse", () => {
  it("maps AuthorizationError to 403", () => {
    const { context, json } = createTestContext();
    routeErrorResponse(context as any, new AuthorizationError(AuthorizationErrorCode.Forbidden, "Access denied"));
    expect(json).toHaveBeenCalledWith(
      { message: "Access denied", code: AuthorizationErrorCode.Forbidden },
      403,
    );
  });

  it("maps DomainValidationError to 400", () => {
    const { context, json } = createTestContext();
    routeErrorResponse(context as any, new DomainValidationError("name must not be blank"));
    expect(json).toHaveBeenCalledWith(
      { message: "name must not be blank" },
      400,
    );
  });

  it("maps BusinessRuleViolationError to 409", () => {
    const { context, json } = createTestContext();
    routeErrorResponse(context as any, new BusinessRuleViolationError("CLASS_GROUP_CAPACITY_EXCEEDED", "Capacity exceeded"));
    expect(json).toHaveBeenCalledWith(
      { message: "Capacity exceeded", code: "CLASS_GROUP_CAPACITY_EXCEEDED" },
      409,
    );
  });

  it("maps unknown errors to 500", () => {
    const { context, json } = createTestContext();
    routeErrorResponse(context as any, new Error("unexpected"));
    expect(json).toHaveBeenCalledWith(
      { message: "Internal server error occurred" },
      500,
    );
  });
});

describe("response helpers", () => {
  it("forbiddenResponse includes optional code", () => {
    const { context, json } = createTestContext();
    forbiddenResponse(context as any, new AuthorizationError(AuthorizationErrorCode.Forbidden, "Denied"));
    expect(json).toHaveBeenCalledWith({ message: "Denied", code: AuthorizationErrorCode.Forbidden }, 403);
  });

  it("conflictResponse includes business rule code", () => {
    const { context, json } = createTestContext();
    conflictResponse(context as any, new BusinessRuleViolationError("RULE", "Blocked"));
    expect(json).toHaveBeenCalledWith({ message: "Blocked", code: "RULE" }, 409);
  });

  it("badRequestResponse merges details", () => {
    const { context, json } = createTestContext();
    badRequestResponse(context as any, "Invalid", { field: "name" });
    expect(json).toHaveBeenCalledWith({ message: "Invalid", field: "name" }, 400);
  });
});

describe("getEntityWriteService authorization cache invalidation", () => {
  beforeEach(() => {
    clearEffectiveGrantsCache();
  });

  function createMockEntityService(overrides: Record<string, unknown> = {}) {
    return {
      list: mock(),
      findOne: mock(),
      count: mock(),
      findById: mock().mockResolvedValue(undefined),
      findByIds: mock().mockResolvedValue([]),
      save: mock().mockResolvedValue(undefined),
      batchSave: mock().mockResolvedValue([]),
      delete: mock().mockResolvedValue(undefined),
      batchDelete: mock().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  async function expectCacheInvalidatedAfterSave(
    serviceName: CoreEntityKey,
    entity: Record<string, unknown>,
    actorType: "student" | "guardian" | "staff",
    actorId: string,
  ) {
    const resolveActorGrants = mock().mockResolvedValue({
      permissions: new Set(),
      scopeGrants: [],
      isElevated: false,
    });
    const repositories = {
      authorization: { resolveActorGrants },
    } as any;

    const cacheArgs = {
      actorId,
      actorType,
      schoolId: "school-1",
      subjectId: "auth-subject",
      sessionId: "session-1",
      authenticatedAt: new Date("2026-01-01T00:00:00Z"),
      repositories,
    };

    await resolveCachedEffectiveGrants(cacheArgs);
    expect(resolveActorGrants).toHaveBeenCalledTimes(1);

    const writeService = getEntityWriteService({
      baseService: {
        entities: {
          [serviceName]: createMockEntityService(),
        },
      },
    } as any, serviceName);

    await writeService!.save(entity);

    await resolveCachedEffectiveGrants(cacheArgs);
    expect(resolveActorGrants).toHaveBeenCalledTimes(2);
  }

  it("invalidates student grants when enrollments are saved", async () => {
    await expectCacheInvalidatedAfterSave(
      "enrollments",
      { studentId: "student-1", schoolId: "school-1" },
      "student",
      "student-1",
    );
  });

  it("invalidates guardian and student grants when guardian links are saved", async () => {
    const resolveActorGrants = mock().mockResolvedValue({
      permissions: new Set(),
      scopeGrants: [],
      isElevated: false,
    });
    const repositories = {
      authorization: { resolveActorGrants },
    } as any;

    const guardianCacheArgs = {
      actorId: "guardian-1",
      actorType: "guardian" as const,
      schoolId: "school-1",
      subjectId: "auth-guardian",
      sessionId: "session-guardian",
      authenticatedAt: new Date("2026-01-01T00:00:00Z"),
      repositories,
    };
    const studentCacheArgs = {
      actorId: "student-1",
      actorType: "student" as const,
      schoolId: "school-1",
      subjectId: "auth-student",
      sessionId: "session-student",
      authenticatedAt: new Date("2026-01-01T00:00:00Z"),
      repositories,
    };

    await resolveCachedEffectiveGrants(guardianCacheArgs);
    await resolveCachedEffectiveGrants(studentCacheArgs);
    expect(resolveActorGrants).toHaveBeenCalledTimes(2);

    const writeService = getEntityWriteService({
      baseService: {
        entities: {
          guardianLinks: createMockEntityService(),
        },
      },
    } as any, "guardianLinks");

    await writeService!.save({
      guardianId: "guardian-1",
      studentId: "student-1",
      schoolId: "school-1",
    });

    await resolveCachedEffectiveGrants(guardianCacheArgs);
    await resolveCachedEffectiveGrants(studentCacheArgs);
    expect(resolveActorGrants).toHaveBeenCalledTimes(4);
  });
});
