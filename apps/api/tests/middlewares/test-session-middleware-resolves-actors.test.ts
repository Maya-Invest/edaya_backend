import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import {
  clearEffectiveGrantsCache,
  invalidateEffectiveGrantsCacheForStaff,
  resolveCachedEffectiveGrants,
} from "@/lib/authorization-grants-cache";
import type { AppBindings } from "@/lib/types";
import { createDependenciesInjection } from "@/middlewares/dependencies-injection";
import { createSessionActorDependency } from "@/middlewares/dependencies/actor";

describe("session Middleware ActorMetadata Construction", () => {
  const getSession = mock();

  beforeEach(() => {
    getSession.mockReset();
    clearEffectiveGrantsCache();
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
      roles: ["teacher"],
      isActive: true,
    };

    getSession.mockResolvedValueOnce(mockSession as any);

    const findStaffMock = mock().mockResolvedValueOnce(mockStaff);
    const findStaffByIdMock = mock().mockResolvedValueOnce(mockStaff);
    const listStaffAssignmentsMock = mock().mockResolvedValueOnce([{
      id: "assignment-1",
      staffId: "staff-1",
      role: "teacher",
      classGroupId: "class-1",
      createdAt: new Date(),
    }]);
    const mockRepos = {
      staffMembers: { findOne: findStaffMock, findById: findStaffByIdMock },
      staffAssignments: { list: listStaffAssignmentsMock },
      ...mockAccessControlForStaff("staff-1", "school-1"),
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
    expect(findStaffByIdMock).toHaveBeenCalledWith("staff-1");
    expect(listStaffAssignmentsMock).toHaveBeenCalledWith({ staffId: "staff-1" });
    expect(mockRepos.guardians.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(mockRepos.students.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(body.actor).toEqual({
      ...mockInteractiveContext("auth-user-999", createdAt, "req-fixed"),
      kind: "staff",
      schoolId: "school-1",
      sessionId: "session-999",
      staffMemberId: "staff-1",
      effectiveGrants: {
        permissions: {},
        isElevated: false,
        scopeGrants: [
          { permission: "GRADE_INPUT", scopeType: "class_group", scopeEntityIds: ["class-1"] },
          { permission: "ATTENDANCE_RECORD", scopeType: "class_group", scopeEntityIds: ["class-1"] },
          { permission: "CLASS_LOGBOOK_CREATE", scopeType: "class_group", scopeEntityIds: ["class-1"] },
          { permission: "CLASS_LOGBOOK_UPDATE", scopeType: "class_group", scopeEntityIds: ["class-1"] },
          { permission: "DISCIPLINE_CREATE", scopeType: "class_group", scopeEntityIds: ["class-1"] },
        ],
      },
    });
  });

  it("should preserve explicit session assurance level on staff actors", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValueOnce({
      user: { id: "auth-user-verified" },
      session: {
        id: "session-verified",
        createdAt,
        assuranceLevel: "verified",
      },
    } as any);

    const mockStaff = {
      id: "staff-verified",
      schoolId: "school-1",
      roles: ["teacher"],
      isActive: true,
    };
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValueOnce(mockStaff),
        findById: mock().mockResolvedValueOnce(mockStaff),
      },
      staffAssignments: { list: mock().mockResolvedValueOnce([]) },
      ...mockAccessControlForStaff("staff-verified", "school-1"),
      guardians: { findOne: mock().mockResolvedValueOnce(null) },
      students: { findOne: mock().mockResolvedValueOnce(null) },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor.assuranceLevel).toBe("verified");
  });

  it("should reuse cached staff effective grants for the same auth session", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValue({
      user: { id: "auth-user-cached" },
      session: {
        id: "session-cached",
        createdAt,
      },
    } as any);

    const mockStaff = {
      id: "staff-cached",
      schoolId: "school-1",
      roles: ["teacher"],
      isActive: true,
    };
    const findStaffByIdMock = mock().mockResolvedValue(mockStaff);
    const listStaffAssignmentsMock = mock().mockResolvedValue([{
      id: "assignment-cached",
      staffId: "staff-cached",
      role: "teacher",
      classGroupId: "class-1",
      createdAt: new Date(),
    }]);
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValue(mockStaff),
        findById: findStaffByIdMock,
      },
      staffAssignments: { list: listStaffAssignmentsMock },
      ...mockAccessControlForStaff("staff-cached", "school-1"),
      guardians: { findOne: mock().mockResolvedValue(null) },
      students: { findOne: mock().mockResolvedValue(null) },
    };

    const app = setupMockApp(mockRepos);
    await app.request("/test-protected");
    await app.request("/test-protected");

    expect(mockRepos.staffMembers.findOne).toHaveBeenCalledTimes(2);
    expect(findStaffByIdMock).toHaveBeenCalledTimes(1);
    expect(listStaffAssignmentsMock).toHaveBeenCalledTimes(1);
  });

  it("should refresh cached staff effective grants after staff invalidation", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValue({
      user: { id: "auth-user-invalidated" },
      session: {
        id: "session-invalidated",
        createdAt,
      },
    } as any);

    const mockStaff = {
      id: "staff-invalidated",
      schoolId: "school-1",
      roles: ["teacher"],
      isActive: true,
    };
    const findStaffByIdMock = mock().mockResolvedValue(mockStaff);
    const listStaffAssignmentsMock = mock().mockResolvedValue([{
      id: "assignment-invalidated",
      staffId: "staff-invalidated",
      role: "teacher",
      classGroupId: "class-1",
      createdAt: new Date(),
    }]);
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValue(mockStaff),
        findById: findStaffByIdMock,
      },
      staffAssignments: { list: listStaffAssignmentsMock },
      ...mockAccessControlForStaff("staff-invalidated", "school-1"),
      guardians: { findOne: mock().mockResolvedValue(null) },
      students: { findOne: mock().mockResolvedValue(null) },
    };

    const app = setupMockApp(mockRepos);
    await app.request("/test-protected");
    invalidateEffectiveGrantsCacheForStaff("staff-invalidated", "school-1");
    await app.request("/test-protected");

    expect(findStaffByIdMock).toHaveBeenCalledTimes(2);
    expect(listStaffAssignmentsMock).toHaveBeenCalledTimes(2);
  });

  it("should expire cached staff effective grants at assignment endsAt", async () => {
    const mockStaff = {
      id: "staff-temporary",
      schoolId: "school-1",
      roles: ["teacher"],
      isActive: true,
    };
    const accessControl = mockAccessControlForStaff("staff-temporary", "school-1", {
      endsAt: new Date("2026-01-01T00:01:00Z"),
    });
    const mockRepos = {
      staffMembers: {
        findById: mock().mockResolvedValue(mockStaff),
      },
      staffAssignments: { list: mock().mockResolvedValue([]) },
      ...accessControl,
    } as any;

    await resolveCachedEffectiveGrants({
      staffMemberId: "staff-temporary",
      schoolId: "school-1",
      subjectId: "auth-user-temporary",
      sessionId: "session-temporary",
      authenticatedAt: new Date("2026-01-01T00:00:00Z"),
      repositories: mockRepos,
      now: new Date("2026-01-01T00:00:00Z"),
      ttlMs: 10 * 60 * 1000,
    });

    await expect(resolveCachedEffectiveGrants({
      staffMemberId: "staff-temporary",
      schoolId: "school-1",
      subjectId: "auth-user-temporary",
      sessionId: "session-temporary",
      authenticatedAt: new Date("2026-01-01T00:00:00Z"),
      repositories: mockRepos,
      now: new Date("2026-01-01T00:01:00Z"),
      ttlMs: 10 * 60 * 1000,
    })).rejects.toThrow();
    expect(mockRepos.staffMembers.findById).toHaveBeenCalledTimes(2);
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
      effectiveGrants: {
        isElevated: false,
        permissions: {},
        scopeGrants: [],
      },
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
      effectiveGrants: {
        isElevated: false,
        permissions: {},
        scopeGrants: [],
      },
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

function mockAccessControlForStaff(staffId: string, schoolId: string, assignmentOverrides: Record<string, unknown> = {}) {
  const roleId = `system_role:${schoolId}:teacher`;
  const accessRole = {
    id: roleId,
    schoolId,
    name: "Teacher",
    permissions: [
      "GRADE_INPUT",
      "ATTENDANCE_RECORD",
      "CLASS_LOGBOOK_CREATE",
      "CLASS_LOGBOOK_UPDATE",
      "DISCIPLINE_CREATE",
    ],
    status: "active",
  };
  const assignment = {
    id: `role_assignment:${schoolId}:${staffId}`,
    staffId,
    schoolId,
    roleIds: [roleId],
    scopeGrants: [],
    status: "active",
    ...assignmentOverrides,
  };

  return {
    accessRoles: {
      findByIds: mock().mockResolvedValue([accessRole]),
    },
    staffRoleAssignments: {
      list: mock().mockResolvedValue([assignment]),
    },
  };
}
