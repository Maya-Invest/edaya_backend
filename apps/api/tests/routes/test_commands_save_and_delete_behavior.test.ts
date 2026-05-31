import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import commandsRouter from "@/routes/commands.route";
import { ActorAssuranceLevel, DisciplinaryAction, DisciplinaryActionKind, GradeLevel, Resource, StaffRole } from "@edaya/core";
import type { AppBindings } from "@/lib/types";

describe("commands Route POST and DELETE Mutation Actions", () => {
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

  const setupTestApp = (mockConfig: any) => {
    const app = new Hono<AppBindings>();

    // Set custom Hono context variables
    app.use(async (c, next) => {
      c.set("actor", mockActor);
      c.set("schoolApp", {
        forActor: () => ({
          config: mockConfig,
        }),
      } as any);
      await next();
    });

    app.route("/", commandsRouter);
    return app;
  };

  it("should successfully save a GradeLevel entity and return 201", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockCommands = {
      gradeLevels: {
        save: mockSave,
      },
    };

    const app = setupTestApp(mockCommands);
    const payload = {
      id: "grade-level-6",
      name: "Grade 6",
      order: 6,
    };

    const res = await app.request("/gradeLevels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await res.json()) as any;
    expect(res.status).toBe(201);
    expect(mockSave).toHaveBeenCalled();
    const passedEntity = mockSave.mock.calls[0][0];
    expect(passedEntity).toBeInstanceOf(GradeLevel);
    expect(passedEntity.id).toBe("grade-level-6");
    expect(passedEntity.schoolId).toBe("school-1");
    expect(passedEntity.name).toBe("Grade 6");
    expect(passedEntity.order).toBe(6);
  });

  it("should successfully save a DisciplinaryAction entity and return 201", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockCommands = {
      disciplinaryActions: {
        save: mockSave,
      },
    };

    const app = setupTestApp(mockCommands);
    const payload = {
      id: "da-123",
      name: "Suspension",
      kind: DisciplinaryActionKind.Sanction,
    };

    const res = await app.request("/disciplinaryActions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    expect(mockSave).toHaveBeenCalled();
    const passedEntity = mockSave.mock.calls[0][0];
    expect(passedEntity).toBeInstanceOf(DisciplinaryAction);
    expect(passedEntity.id).toBe("da-123");
    expect(passedEntity.schoolId).toBe("school-1");
    expect(passedEntity.name).toBe("Suspension");
    expect(passedEntity.kind).toBe(DisciplinaryActionKind.Sanction);
  });

  it("should return 400 Bad Request for unsupported write entity", async () => {
    const mockCommands = {};
    const app = setupTestApp(mockCommands);

    const res = await app.request("/invalidEntity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toContain("not write-supported");
  });

  it("should successfully delete a Resource entity and return 200", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockCommands = {
      resources: {
        delete: mockDelete,
      },
    };

    const app = setupTestApp(mockCommands);

    const res = await app.request("/resources/res-123", {
      method: "DELETE",
    });

    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("res-123");
    expect(body.message).toBe("resources with ID res-123 deleted");
  });

  it("should handle AuthorizationError and return 403 Forbidden", async () => {
    const authError = new Error("Not authorized");
    authError.name = "AuthorizationError";
    (authError as any).code = "forbidden";

    const mockSave = vi.fn().mockRejectedValue(authError);
    const mockCommands = {
      gradeLevels: {
        save: mockSave,
      },
    };

    const app = setupTestApp(mockCommands);
    const res = await app.request("/gradeLevels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "gl", name: "GL", order: 1 }),
    });

    const body = (await res.json()) as any;
    expect(res.status).toBe(403);
    expect(body.code).toBe("forbidden");
  });
});
