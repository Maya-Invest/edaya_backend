import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppBindings } from "@/lib/types";
import { createDependenciesInjection } from "@/middlewares/dependencies-injection";
import { createSessionActorDependency } from "@/middlewares/dependencies/actor";

describe("session Middleware ActorMetadata Construction", () => {
  const getSession = vi.fn();

  beforeEach(() => {
    getSession.mockReset();
  });

  const mockInteractiveContext = (userId: string, createdAt: string) => ({
    subjectId: userId,
    schoolId: "school-default",
    requestId: expect.any(String),
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

    const mockRepos = {
      staffMembers: { findOne: vi.fn() },
      guardians: { findOne: vi.fn() },
      students: { findOne: vi.fn() },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor).toBeNull();
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
        createdAt,
      },
    };

    const mockStaff = {
      id: "staff-1",
      schoolId: "school-1",
      roles: ["admin", "teacher"],
    };

    getSession.mockResolvedValueOnce(mockSession as any);

    const findStaffMock = vi.fn().mockResolvedValueOnce(mockStaff);
    const mockRepos = {
      staffMembers: { findOne: findStaffMock },
      guardians: { findOne: vi.fn() },
      students: { findOne: vi.fn() },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(findStaffMock).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(body.actor).toEqual({
      ...mockInteractiveContext("auth-user-999", createdAt),
      kind: "staff",
      schoolId: "school-1",
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

    const findStaffMock = vi.fn().mockResolvedValueOnce(null);
    const findGuardianMock = vi.fn().mockResolvedValueOnce(mockGuardian);
    const mockRepos = {
      staffMembers: { findOne: findStaffMock },
      guardians: { findOne: findGuardianMock },
      students: { findOne: vi.fn() },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(findStaffMock).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
    expect(findGuardianMock).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
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

    const findStaffMock = vi.fn().mockResolvedValueOnce(null);
    const findGuardianMock = vi.fn().mockResolvedValueOnce(null);
    const findStudentMock = vi.fn().mockResolvedValueOnce(mockStudent);
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
});
