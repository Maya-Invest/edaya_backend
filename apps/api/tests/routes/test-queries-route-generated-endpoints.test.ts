import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import indexRouter from "@/routes/index.route";
import { ActorAssuranceLevel, StaffRole } from "@edaya/core";
import type { AppBindings } from "@/lib/types";

describe("generated query endpoints", () => {
  const mockActor = {
    kind: "staff" as const,
    subjectId: "admin-user",
    schoolId: "school-1",
    staffMemberId: "staff-1",
    roles: [StaffRole.Admin],
    requestId: "request-id",
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Strong,
  };

  const setupTestApp = (mockQueries: any) => {
    const app = new Hono<AppBindings>();

    app.use(async (c, next) => {
      c.set("actor", mockActor);
      c.set("schoolApp", {
        forActor: () => ({
          queries: mockQueries,
        }),
      } as any);
      await next();
    });

    app.route("/", indexRouter);
    return app;
  };

  it("should expose count for AuthorizedReadService-backed query entities", async () => {
    const mockCount = vi.fn().mockResolvedValue(2);
    const app = setupTestApp({
      students: {
        count: mockCount,
      },
    });

    const res = await app.request("/api/queries/students/count", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: "550e8400-e29b-41d4-a716-446655440000",
        $limit: 10,
      }),
    });

    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(mockCount).toHaveBeenCalledWith({
      schoolId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("should expose findOne for AuthorizedReadService-backed query entities", async () => {
    const student = {
      id: "student-1",
      schoolId: "school-1",
      firstName: "Maya",
      lastName: "Diallo",
    };
    const mockFindOne = vi.fn().mockResolvedValue(student);
    const app = setupTestApp({
      students: {
        findOne: mockFindOne,
      },
    });

    const res = await app.request("/api/queries/students/one", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body).toEqual(expect.objectContaining(student));
    expect(mockFindOne).toHaveBeenCalledWith({});
  });
});
