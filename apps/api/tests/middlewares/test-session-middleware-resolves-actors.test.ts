import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { AppBindings } from "@/lib/types";
import { createDependenciesInjection } from "@/middlewares/dependencies-injection";
import { createSessionActorDependency } from "@/middlewares/dependencies/actor";

describe("session Middleware ActorMetadata Construction", () => {
  const getSession = mock();

  beforeEach(() => {
    getSession.mockReset();
  });

  const mockInteractiveContext = (userId: string, createdAt: string, requestId = expect.any(String)) => ({
    subjectId: userId,
    requestId,
    authenticatedAt: createdAt,
    assuranceLevel: "standard",
  });

  const setupMockApp = (mockRepos: any) => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.set("schoolApp", {
        repositories: mockRepos,
      } as any);
      await next();
    });
    app.use(createDependenciesInjection([
      createSessionActorDependency(() => ({
        api: {
          getSession,
        },
      })),
    ]));
    app.get("/test-protected", (c) => {
      const actor = c.get("actor");
      return c.json({ actor });
    });
    return app;
  };

  it("should construct null actor when no session exists", async () => {
    getSession.mockResolvedValueOnce(null);

    const mockRepos = createMockRepos();

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor).toBeNull();
    expect(mockRepos.staffMembers.findOne).not.toHaveBeenCalled();
    expect(mockRepos.guardians.findOne).not.toHaveBeenCalled();
    expect(mockRepos.students.findOne).not.toHaveBeenCalled();
  });

  it.each([
    ["missing user", { session: { createdAt: new Date().toISOString() } }],
    ["missing user id", { user: {}, session: { createdAt: new Date().toISOString() } }],
    ["blank user id", { user: { id: " " }, session: { createdAt: new Date().toISOString() } }],
    ["missing session", { user: { id: "auth-user" } }],
  ])("should construct null actor for malformed sessions: %s", async (_caseName, malformedSession) => {
    getSession.mockResolvedValueOnce(malformedSession as any);

    const mockRepos = createMockRepos();
    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor).toBeNull();
    expect(mockRepos.staffMembers.findOne).not.toHaveBeenCalled();
    expect(mockRepos.guardians.findOne).not.toHaveBeenCalled();
    expect(mockRepos.students.findOne).not.toHaveBeenCalled();
  });

  it("should construct null actor when session.createdAt is missing", async () => {
    getSession.mockResolvedValueOnce({
      user: { id: "auth-user-missing-date" },
      session: {},
    } as any);

    const mockRepos = createMockRepos();
    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor).toBeNull();
    expect(mockRepos.staffMembers.findOne).not.toHaveBeenCalled();
    expect(mockRepos.guardians.findOne).not.toHaveBeenCalled();
    expect(mockRepos.students.findOne).not.toHaveBeenCalled();
  });

  it("should construct null actor when session.createdAt is invalid", async () => {
    getSession.mockResolvedValueOnce({
      user: { id: "auth-user-invalid-date" },
      session: { createdAt: "not-a-date" },
    } as any);

    const mockRepos = createMockRepos();
    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor).toBeNull();
    expect(mockRepos.staffMembers.findOne).not.toHaveBeenCalled();
    expect(mockRepos.guardians.findOne).not.toHaveBeenCalled();
    expect(mockRepos.students.findOne).not.toHaveBeenCalled();
  });

  it("should construct StaffActorMetadata when user matches a staff member record", async () => {
    const createdAt = new Date().toISOString();
    const mockSession = {
      user: {
        id: "auth-user-999",
        email: "staff@school.edu",
        name: "Staff User",
      },
      session: {
        id: "session-999",
        createdAt,
      },
    };

    const mockStaff = {
      id: "staff-1",
      schoolId: "school-1",
      roles: ["admin", "teacher"],
    };

    getSession.mockResolvedValueOnce(mockSession as any);

    const findStaffMock = mock().mockResolvedValueOnce(mockStaff);
    const mockRepos = {
      staffMembers: { findOne: findStaffMock },
      guardians: { findOne: mock().mockResolvedValueOnce(null) },
      students: { findOne: mock().mockResolvedValueOnce(null) },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected", {
      headers: {
        "x-request-id": "req-fixed",
      },
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(findStaffMock).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(mockRepos.guardians.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(mockRepos.students.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(body.actor).toEqual({
      ...mockInteractiveContext("auth-user-999", createdAt, "req-fixed"),
      kind: "staff",
      schoolId: "school-1",
      sessionId: "session-999",
      staffMemberId: "staff-1",
      roles: ["admin", "teacher"],
    });
  });

  it("should construct GuardianActorMetadata when user matches a guardian record", async () => {
    const createdAt = new Date().toISOString();
    const mockSession = {
      user: {
        id: "auth-user-888",
        email: "guardian@parents.org",
        name: "Parent User",
      },
      session: {
        createdAt,
      },
    };

    const mockGuardian = {
      id: "guardian-1",
      schoolId: "school-1",
    };

    getSession.mockResolvedValueOnce(mockSession as any);

    const findStaffMock = mock().mockResolvedValueOnce(null);
    const findGuardianMock = mock().mockResolvedValueOnce(mockGuardian);
    const mockRepos = {
      staffMembers: { findOne: findStaffMock },
      guardians: { findOne: findGuardianMock },
      students: { findOne: mock().mockResolvedValueOnce(null) },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(findStaffMock).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
    expect(findGuardianMock).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
    expect(mockRepos.students.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
    expect(body.actor).toEqual({
      ...mockInteractiveContext("auth-user-888", createdAt),
      kind: "guardian",
      schoolId: "school-1",
      guardianId: "guardian-1",
    });
  });

  it("should construct StudentActorMetadata when user matches a student record", async () => {
    const createdAt = new Date().toISOString();
    const mockSession = {
      user: {
        id: "auth-user-777",
        email: "student@students.edu",
        name: "Student User",
      },
      session: {
        createdAt,
      },
    };

    const mockStudent = {
      id: "student-1",
      schoolId: "school-1",
    };

    getSession.mockResolvedValueOnce(mockSession as any);

    const findStaffMock = mock().mockResolvedValueOnce(null);
    const findGuardianMock = mock().mockResolvedValueOnce(null);
    const findStudentMock = mock().mockResolvedValueOnce(mockStudent);
    const mockRepos = {
      staffMembers: { findOne: findStaffMock },
      guardians: { findOne: findGuardianMock },
      students: { findOne: findStudentMock },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(findStaffMock).toHaveBeenCalledWith({ subjectId: "auth-user-777" });
    expect(findGuardianMock).toHaveBeenCalledWith({ subjectId: "auth-user-777" });
    expect(findStudentMock).toHaveBeenCalledWith({ subjectId: "auth-user-777" });
    expect(body.actor).toEqual({
      ...mockInteractiveContext("auth-user-777", createdAt),
      kind: "student",
      schoolId: "school-1",
      studentId: "student-1",
    });
  });

  it("should construct null actor when identity resolution is ambiguous", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValueOnce({
      user: {
        id: "auth-user-ambiguous",
      },
      session: {
        createdAt,
      },
    });

    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValueOnce({
          id: "staff-1",
          schoolId: "school-1",
          roles: ["admin"],
        }),
      },
      guardians: {
        findOne: mock().mockResolvedValueOnce({
          id: "guardian-1",
          schoolId: "school-1",
        }),
      },
      students: {
        findOne: mock().mockResolvedValueOnce(null),
      },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(mockRepos.staffMembers.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-ambiguous" });
    expect(mockRepos.guardians.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-ambiguous" });
    expect(mockRepos.students.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-ambiguous" });
    expect(body.actor).toBeNull();
  });
});

function createMockRepos() {
  return {
    staffMembers: { findOne: mock() },
    guardians: { findOne: mock() },
    students: { findOne: mock() },
  };
}
