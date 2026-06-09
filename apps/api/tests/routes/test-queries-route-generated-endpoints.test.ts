import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import indexRouter from "@/routes/index.route";
import type { Permission } from "@edaya/core";
import { ActorAssuranceLevel } from "@edaya/core";
import type { AppBindings } from "@/lib/types";

describe("generated core query endpoints", () => {
  const mockActor = {
    kind: "staff" as const,
    subjectId: "admin-user",
    schoolId: "school-1",
    staffMemberId: "staff-1",
    effectiveGrants: {
      permissions: new Set<Permission>(),
      scopeGrants: [],
      isElevated: true,
    },
    requestId: "request-id",
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Strong,
  };

  const setupTestApp = (service: Record<string, unknown>) => {
    const app = new Hono<AppBindings>();

    app.use(async (c, next) => {
      c.set("actor", mockActor);
      c.set("schoolApp", {
        forActor: () => service,
      } as any);
      await next();
    });

    app.route("/", indexRouter);
    return app;
  };

  const mockReadService = (overrides: Record<string, unknown>) => ({
    list: mock().mockResolvedValue([]),
    findOne: mock().mockResolvedValue(undefined),
    count: mock().mockResolvedValue(0),
    findById: mock().mockResolvedValue(undefined),
    findByIds: mock().mockResolvedValue([]),
    save: mock().mockResolvedValue(undefined),
    batchSave: mock().mockResolvedValue([]),
    delete: mock().mockResolvedValue(undefined),
    batchDelete: mock().mockResolvedValue(undefined),
    ...overrides,
  });

  it("counts generated core entities", async () => {
    const mockCount = mock().mockResolvedValue(2);
    const app = setupTestApp({
      baseService: {
        students: mockReadService({ count: mockCount }),
      },
    });

    const res = await app.request("/api/core/entities/students/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "550e8400-e29b-41d4-a716-446655440000",
        $limit: 10,
      }),
    });

    const body = await res.json() as { count: number };
    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(mockCount).toHaveBeenCalledWith({
      schoolId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("finds one generated core entity", async () => {
    const student = {
      id: "student-1",
      schoolId: "school-1",
      firstName: "Maya",
      lastName: "Diallo",
    };
    const mockFindOne = mock().mockResolvedValue(student);
    const app = setupTestApp({
      baseService: {
        students: mockReadService({ findOne: mockFindOne }),
      },
    });

    const res = await app.request("/api/core/entities/students/one", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(expect.objectContaining(student));
    expect(mockFindOne).toHaveBeenCalledWith({});
  });

  it("executes aggregate core query routes", async () => {
    const mockGetOverdueFeeCount = mock().mockResolvedValue(3);
    const app = setupTestApp({
      baseService: {},
      getOverdueFeeCount: mockGetOverdueFeeCount,
    });

    const res = await app.request("/api/core/queries/get-overdue-fee-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: "school-1" }),
    });

    const body = await res.json() as { count: number };
    expect(res.status).toBe(200);
    expect(body.count).toBe(3);
    expect(mockGetOverdueFeeCount).toHaveBeenCalledWith("school-1");
  });
});
