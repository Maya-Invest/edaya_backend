import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import indexRouter from "@/routes/index.route";
import { ActorAssuranceLevel, DisciplinaryAction, DisciplinaryActionKind, GradeLevel, Resource, StaffRole } from "@edaya/core";
import type { AppBindings } from "@/lib/types";

describe("config command route pairs", () => {
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

    app.route("/", indexRouter);
    return app;
  };

  const mockWriteService = (overrides: Record<string, unknown>) => ({
    save: mock().mockResolvedValue(undefined),
    delete: mock().mockResolvedValue(undefined),
    ...overrides,
  });

  it("should successfully save a GradeLevel entity and return 201", async () => {
    const mockSave = mock().mockResolvedValue(undefined);
    const mockCommands = {
      gradeLevels: mockWriteService({
        save: mockSave,
      }),
    };

    const app = setupTestApp(mockCommands);
    const payload = {
      id: "grade-level-6",
      name: "Grade 6",
      order: 6,
    };

    const res = await app.request("/api/commands/config/gradeLevels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    expect(mockSave).toHaveBeenCalled();
    const passedEntity = mockSave.mock.calls[0][0];
    expect(passedEntity).toBeInstanceOf(GradeLevel);
    expect(passedEntity.id).toBe("grade-level-6");
    expect(passedEntity.schoolId).toBe("school-1");
    expect(passedEntity.name).toBe("Grade 6");
    expect(passedEntity.order).toBe(6);
  });

  it("should expose generated config command endpoints under /api/commands/config", async () => {
    const mockSave = mock().mockResolvedValue(undefined);
    const mockCommands = {
      resources: mockWriteService({
        save: mockSave,
      }),
    };

    const app = setupTestApp(mockCommands);
    const payload = {
      id: "resource-1",
      name: "Lab 1",
      kind: "location",
      capacity: 30,
    };

    const res = await app.request("/api/commands/config/resources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    expect(mockSave).toHaveBeenCalled();
    const passedEntity = mockSave.mock.calls[0][0];
    expect(passedEntity).toBeInstanceOf(Resource);
    expect(passedEntity.id).toBe("resource-1");
    expect(passedEntity.schoolId).toBe("school-1");
    expect(passedEntity.name).toBe("Lab 1");
    expect(passedEntity.capacity).toBe(30);
  });

  it("should successfully save a DisciplinaryAction entity and return 201", async () => {
    const mockSave = mock().mockResolvedValue(undefined);
    const mockCommands = {
      disciplinaryActions: mockWriteService({
        save: mockSave,
      }),
    };

    const app = setupTestApp(mockCommands);
    const payload = {
      id: "da-123",
      name: "Suspension",
      kind: DisciplinaryActionKind.Sanction,
    };

    const res = await app.request("/api/commands/config/disciplinaryActions", {
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

  it("should return 400 Bad Request for unsupported write service", async () => {
    const mockCommands = {};
    const app = setupTestApp(mockCommands);

    const res = await app.request("/api/commands/config/resources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "resource-1",
        name: "Lab 1",
        kind: "location",
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Entity resources is not write-supported");
  });

  it("should successfully delete a Resource entity and return 200", async () => {
    const mockDelete = mock().mockResolvedValue(undefined);
    const mockCommands = {
      resources: mockWriteService({
        delete: mockDelete,
      }),
    };

    const app = setupTestApp(mockCommands);

    const res = await app.request("/api/commands/config/resources/res-123", {
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

    const mockSave = mock().mockRejectedValue(authError);
    const mockCommands = {
      gradeLevels: mockWriteService({
        save: mockSave,
      }),
    };

    const app = setupTestApp(mockCommands);
    const res = await app.request("/api/commands/config/gradeLevels", {
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

  it("should hide unexpected command errors behind the standard 500 response", async () => {
    const mockSave = mock().mockRejectedValue(new Error("database connection details"));
    const mockCommands = {
      gradeLevels: mockWriteService({
        save: mockSave,
      }),
    };

    const app = setupTestApp(mockCommands);
    const res = await app.request("/api/commands/config/gradeLevels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "gl", name: "GL", order: 1 }),
    });

    const body = (await res.json()) as any;
    expect(res.status).toBe(500);
    expect(body.message).toBe("Internal server error occurred");
  });
});
