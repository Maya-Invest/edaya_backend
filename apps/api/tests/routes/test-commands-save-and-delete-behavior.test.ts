import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import indexRouter from "@/app-router";
import type { Permission } from "@edaya/core";
import { GradeLevel } from "@edaya/core";
import { ActorAssuranceLevel } from "@edaya/authorization";
import type { AppBindings } from "@/http/types";

describe("core entity and command routes", () => {
  const mockActor = {
    kind: "staff" as const,
    accountKind: "human" as const,
    actorId: "staff-1",
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

  const mockEntityService = (overrides: Record<string, unknown>) => ({
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

  it("saves an entity through /core/entities/{entity-name}/save", async () => {
    const mockSave = mock().mockResolvedValue(undefined);
    const app = setupTestApp({
      baseService: {
        entities: {
          gradeLevels: mockEntityService({ save: mockSave }),
        },
      },
    });

    const res = await app.request("/core/entities/grade-levels/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "grade-level-6",
        schoolId: "school-1",
        name: "Grade 6",
        label: "G6",
        order: 6,
      }),
    });

    expect(res.status).toBe(200);
    expect(mockSave).toHaveBeenCalled();
    const passedEntity = mockSave.mock.calls[0][0];
    expect(passedEntity).toBeInstanceOf(GradeLevel);
    expect(passedEntity.id).toBe("grade-level-6");
    expect(passedEntity.schoolId).toBe("school-1");
  });

  it("deletes an entity with POST /delete", async () => {
    const mockDelete = mock().mockResolvedValue(undefined);
    const app = setupTestApp({
      baseService: {
        entities: {
          gradeLevels: mockEntityService({ delete: mockDelete }),
        },
      },
    });

    const res = await app.request("/core/entities/grade-levels/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "grade-level-6" }),
    });

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("grade-level-6");
  });

  it("does not expose direct save for command-only entities", async () => {
    const mockSave = mock().mockResolvedValue(undefined);
    const app = setupTestApp({
      baseService: {
        entities: {
          students: mockEntityService({ save: mockSave }),
        },
      },
    });

    const res = await app.request("/core/entities/students/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "student-1",
        schoolId: "school-1",
        firstName: "Ada",
        lastName: "Lovelace",
        status: "active",
      }),
    });

    expect(res.status).toBe(404);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("does not dispatch generic finance or enrollment writes even for an elevated actor", async () => {
    const write = mock().mockResolvedValue(undefined);
    const app = setupTestApp({ baseService: { entities: {
      payments: mockEntityService({ save: write, delete: write, batchSave: write, batchDelete: write }),
      studentFees: mockEntityService({ save: write, delete: write, batchSave: write, batchDelete: write }),
      enrollments: mockEntityService({ save: write, delete: write, batchSave: write, batchDelete: write }),
    } } });
    for (const entity of ["payments", "student-fees", "enrollments"]) {
      for (const action of ["save", "delete", "batch-save", "batch-delete"]) {
        const response = await app.request(`/core/entities/${entity}/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: "existing", ids: ["existing"], entities: [{ id: "existing" }] }),
        });
        expect(response.status).toBe(404);
      }
    }
    expect(write).not.toHaveBeenCalled();
  });

  it("returns 422 when entity save payload fails OpenAPI schema validation", async () => {
    const mockSave = mock().mockResolvedValue(undefined);
    const app = setupTestApp({
      baseService: {
        entities: {
          gradeLevels: mockEntityService({ save: mockSave }),
        },
      },
    });

    const res = await app.request("/core/entities/grade-levels/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "grade-level-6",
        schoolId: "school-1",
        name: "",
        order: 6,
      }),
    });

    expect(res.status).toBe(422);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("batch-saves entities with POST /batch-save", async () => {
    const mockBatchSave = mock().mockResolvedValue(["grade-level-6", "grade-level-7"]);
    const app = setupTestApp({
      baseService: {
        entities: {
          gradeLevels: mockEntityService({ batchSave: mockBatchSave }),
        },
      },
    });

    const res = await app.request("/core/entities/grade-levels/batch-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entities: [
          { id: "grade-level-6", schoolId: "school-1", name: "Grade 6", label: "G6", order: 6 },
          { id: "grade-level-7", schoolId: "school-1", name: "Grade 7", label: "G7", order: 7 },
        ],
      }),
    });

    const body = await res.json() as { ids: string[] };
    expect(res.status).toBe(200);
    expect(body.ids).toEqual(["grade-level-6", "grade-level-7"]);
    expect(mockBatchSave).toHaveBeenCalledWith([
      expect.any(GradeLevel),
      expect.any(GradeLevel),
    ]);
  });

  it("batch-deletes entities with POST /batch-delete", async () => {
    const mockBatchDelete = mock().mockResolvedValue(undefined);
    const app = setupTestApp({
      baseService: {
        entities: {
          gradeLevels: mockEntityService({ batchDelete: mockBatchDelete }),
        },
      },
    });

    const res = await app.request("/core/entities/grade-levels/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["grade-level-6", "grade-level-7"] }),
    });

    expect(res.status).toBe(200);
    expect(mockBatchDelete).toHaveBeenCalledWith(["grade-level-6", "grade-level-7"]);
  });

  it("executes kebab-case core command routes directly against SchoolService", async () => {
    const mockCreateAcademicYear = mock().mockResolvedValue({
      id: "academic-year-1",
      schoolId: "school-1",
      name: "2026",
    });
    const app = setupTestApp({
      baseService: {},
      commands: {
        createAcademicYear: mockCreateAcademicYear,
      },
    });

    const res = await app.request("/core/commands/create-academic-year", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "academic-year-1",
        schoolId: "school-1",
        name: "2026",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
      }),
    });

    expect(res.status).toBe(200);
    expect(mockCreateAcademicYear).toHaveBeenCalled();
    const commandInput = mockCreateAcademicYear.mock.calls[0][0];
    expect(commandInput.startDate).toBeInstanceOf(Date);
    expect(commandInput.endDate).toBeInstanceOf(Date);
  });

  it("rejects malformed core command payloads", async () => {
    const mockCreateAcademicYear = mock().mockResolvedValue({});
    const app = setupTestApp({
      baseService: {},
      commands: {
        createAcademicYear: mockCreateAcademicYear,
      },
    });

    const res = await app.request("/core/commands/create-academic-year", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "academic-year-1",
        schoolId: "school-1",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
      }),
    });

    expect(res.status).toBe(422);
    expect(mockCreateAcademicYear).not.toHaveBeenCalled();
  });
});
