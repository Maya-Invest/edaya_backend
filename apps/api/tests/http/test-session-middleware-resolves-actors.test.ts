import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import {
  clearEffectiveGrantsCache,
  invalidateEffectiveGrantsCacheForStaff,
  resolveCachedEffectiveGrants,
} from "@/lib/authorization/grants-cache/resolve-cached";
import { clearActorScopeCache } from "@/lib/authorization/scope-cache/resolve-cached";
import type { AppBindings } from "@/http/types";
import { createDependenciesInjection } from "@/http/dependencies";
import { createSessionActorDependency } from "@/http/dependencies/session-actor";
import { DefaultAuthorizationRepository, Permission } from "@edaya/authorization";

const STAFF_TEACHING_WRITE_TEST_PERMISSIONS: readonly Permission[] = [
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.ATTENDANCE_RECORD,
  Permission.DISCIPLINE_CREATE,
  Permission.GRADE_INPUT,
  Permission.CLASS_LOGBOOK_UPDATE,
];

describe("session Middleware ActorMetadata Construction", () => {
  const getSession = mock();

  beforeEach(() => {
    getSession.mockReset();
    clearEffectiveGrantsCache();
    clearActorScopeCache();
  });

  const mockInteractiveContext = (userId: string, createdAt: string, requestId = expect.any(String)) => ({
    subjectId: userId,
    requestId,
    authenticatedAt: createdAt,
    assuranceLevel: "standard",
  });

  const setupMockApp = (mockRepos: any) => {
    const teachersFindOne = mockRepos.teachers?.findOne ?? mock().mockResolvedValue(null);
    const repos = {
      teachers: { findOne: teachersFindOne },
      ...mockRepos,
    };
    if (repos && !repos.authorization) {
      repos.authorization = new DefaultAuthorizationRepository(repos);
    }
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.set("schoolApp", {
        repositories: repos,
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
  ])("should construct null actor for malformed sessions: %s", async (_caseName: string, malformedSession: any) => {
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
      subjectId: "auth-user-999",
      roles: ["teacher"],
      isActive: true,
    };

    getSession.mockResolvedValueOnce(mockSession as any);

    const findStaffMock = mock().mockResolvedValueOnce(mockStaff);
    const findStaffByIdMock = mock().mockResolvedValue(mockStaff);
    const accessControl = mockAccessControlForStaff("staff-1", "school-1");
    const listPermissionAssignmentsMock = accessControl.staffPermissionAssignments.list;
    const mockRepos = {
      staffMembers: { findOne: findStaffMock, findById: findStaffByIdMock },
      staffAssignments: { list: mock().mockResolvedValue([]) },
      ...accessControl,
      guardians: { findOne: mock().mockResolvedValueOnce(null) },
      students: { findOne: mock().mockResolvedValueOnce(null) },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected", {
      headers: {
        "x-request-id": "req-fixed",
        "x-academic-year-id": "year-2026",
      },
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(findStaffMock).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(findStaffByIdMock).toHaveBeenCalledWith("staff-1");
    expect(listPermissionAssignmentsMock).toHaveBeenCalledWith(expect.objectContaining({
      staffId: "staff-1",
      academicYearId: "year-2026",
      status: "active",
    }));
    expect(mockRepos.staffMembers.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(mockRepos.guardians.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(mockRepos.students.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-999" });
    expect(body.actor).toEqual({
      ...mockInteractiveContext("auth-user-999", createdAt, "req-fixed"),
      kind: "staff",
      accountKind: "human",
      actorId: "staff-1",
      schoolId: "school-1",
      sessionId: "session-999",
      staffMemberId: "staff-1",
      effectiveGrants: {
        permissions: {},
        isElevated: false,
        scopeGrants: [],
        scopeIdsByPermission: Object.fromEntries(
          STAFF_TEACHING_WRITE_TEST_PERMISSIONS.map(permission => [permission, "class-1"]),
        ),
      },
    });
  });

  it("should set verified assurance when the auth user email is verified", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValueOnce({
      user: { id: "auth-user-verified", emailVerified: true },
      session: {
        id: "session-verified",
        createdAt,
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
        findById: mock().mockResolvedValue(mockStaff),
      },
      staffAssignments: { list: mock().mockResolvedValueOnce([]) },
      ...mockAccessControlForStaff("staff-verified", "school-1"),
      guardians: { findOne: mock().mockResolvedValueOnce(null) },
      students: { findOne: mock().mockResolvedValueOnce(null) },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected", {
      headers: { "x-academic-year-id": "year-2026" },
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor.assuranceLevel).toBe("verified");
  });

  it("should keep standard assurance when the auth user email is not verified", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValueOnce({
      user: { id: "auth-user-unverified", emailVerified: false },
      session: {
        id: "session-unverified",
        createdAt,
      },
    } as any);

    const mockStaff = {
      id: "staff-unverified",
      schoolId: "school-1",
      roles: ["teacher"],
      isActive: true,
    };
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValueOnce(mockStaff),
        findById: mock().mockResolvedValue(mockStaff),
      },
      staffAssignments: { list: mock().mockResolvedValueOnce([]) },
      ...mockAccessControlForStaff("staff-unverified", "school-1"),
      guardians: { findOne: mock().mockResolvedValueOnce(null) },
      students: { findOne: mock().mockResolvedValueOnce(null) },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected", {
      headers: { "x-academic-year-id": "year-2026" },
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor.assuranceLevel).toBe("standard");
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
    const accessControl = mockAccessControlForStaff("staff-cached", "school-1");
    const listPermissionAssignmentsMock = accessControl.staffPermissionAssignments.list;
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValue(mockStaff),
        findById: findStaffByIdMock,
      },
      staffAssignments: { list: mock().mockResolvedValue([]) },
      ...accessControl,
      guardians: { findOne: mock().mockResolvedValue(null) },
      students: { findOne: mock().mockResolvedValue(null) },
    };

    const app = setupMockApp(mockRepos);
    await app.request("/test-protected", {
      headers: { "x-academic-year-id": "year-2026" },
    });
    await app.request("/test-protected", {
      headers: { "x-academic-year-id": "year-2026" },
    });

    expect(mockRepos.staffMembers.findOne).toHaveBeenCalledTimes(2);
    expect(findStaffByIdMock).toHaveBeenCalledTimes(2);
    expect(listPermissionAssignmentsMock).toHaveBeenCalledTimes(1);
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
    const accessControl = mockAccessControlForStaff("staff-invalidated", "school-1");
    const listPermissionAssignmentsMock = accessControl.staffPermissionAssignments.list;
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValue(mockStaff),
        findById: findStaffByIdMock,
      },
      staffAssignments: { list: mock().mockResolvedValue([]) },
      ...accessControl,
      guardians: { findOne: mock().mockResolvedValue(null) },
      students: { findOne: mock().mockResolvedValue(null) },
    };

    const app = setupMockApp(mockRepos);
    await app.request("/test-protected", { headers: { "x-academic-year-id": "year-2026" } });
    invalidateEffectiveGrantsCacheForStaff("staff-invalidated", "school-1");
    await app.request("/test-protected", { headers: { "x-academic-year-id": "year-2026" } });

    expect(findStaffByIdMock).toHaveBeenCalledTimes(4);
    expect(listPermissionAssignmentsMock).toHaveBeenCalledTimes(2);
  });

  it("should expire cached staff effective grants at assignment endsAt", async () => {
    const mockStaff = {
      id: "staff-temporary",
      schoolId: "school-1",
      roles: ["teacher"],
      isActive: true,
    };
    const accessControl = mockAccessControlForStaff("staff-temporary", "school-1", "year-2026", {
      endsAt: new Date("2026-01-01T00:01:00Z"),
    });
    const mockRepos = {
      staffMembers: {
        findById: mock().mockResolvedValue(mockStaff),
      },
      staffAssignments: { list: mock().mockResolvedValue([]) },
      ...accessControl,
    } as any;
    mockRepos.authorization = new DefaultAuthorizationRepository(mockRepos);

    await resolveCachedEffectiveGrants({
      staffMemberId: "staff-temporary",
      schoolId: "school-1",
      academicYearId: "year-2026",
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
      academicYearId: "year-2026",
      subjectId: "auth-user-temporary",
      sessionId: "session-temporary",
      authenticatedAt: new Date("2026-01-01T00:00:00Z"),
      repositories: mockRepos,
      now: new Date("2026-01-01T00:01:00Z"),
      ttlMs: 10 * 60 * 1000,
    })).rejects.toThrow();
    expect(mockRepos.staffMembers.findById).toHaveBeenCalledTimes(4);
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
      guardians: {
        findOne: findGuardianMock,
        findById: mock().mockResolvedValueOnce(mockGuardian),
      },
      guardianLinks: {
        list: mock().mockResolvedValueOnce([]),
      },
      students: { findOne: mock().mockResolvedValueOnce(null) },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(findStaffMock).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
    expect(findStaffMock).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
    expect(findGuardianMock).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
    expect(mockRepos.students.findOne).toHaveBeenCalledWith({ subjectId: "auth-user-888" });
    expect(body.actor).toEqual({
      ...mockInteractiveContext("auth-user-888", createdAt),
      kind: "guardian",
      actorId: "guardian-1",
      schoolId: "school-1",
      guardianId: "guardian-1",
      guardianScope: {
        studentIds: [],
        classGroupIds: [],
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
      students: {
        findOne: findStudentMock,
        findById: mock().mockResolvedValueOnce(mockStudent),
      },
      enrollments: {
        list: mock().mockResolvedValueOnce([]),
      },
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
      actorId: "student-1",
      schoolId: "school-1",
      studentId: "student-1",
      studentScope: {
        studentId: "student-1",
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

  it("should construct TeacherActorMetadata when user matches a teacher record", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValueOnce({
      user: {
        id: "auth-user-teacher",
        email: "a.toure@ecole-ci.edaya.dev",
        name: "Mme Touré",
      },
      session: { createdAt },
    } as any);

    const mockTeacher = {
      id: "ci-t1",
      schoolId: "school-1",
      isActive: true,
    };
    const mockRepos = {
      staffMembers: { findOne: mock().mockResolvedValue(null) },
      guardians: { findOne: mock().mockResolvedValue(null) },
      students: { findOne: mock().mockResolvedValue(null) },
      teachers: {
        findOne: mock().mockResolvedValue(mockTeacher),
        findById: mock().mockResolvedValue(mockTeacher),
      },
      teacherAssignments: {
        list: mock().mockResolvedValue([
          {
            id: "ta-1",
            teacherId: "ci-t1",
            academicYearId: "year-1",
            kind: "subject",
            classSubjectId: "ci-cs-6a-math",
            status: "active",
          },
        ]),
      },
      academicYears: {
        findOne: mock().mockResolvedValue({ id: "year-1", schoolId: "school-1", isActive: true }),
      },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected", {
      headers: { "x-academic-year-id": "year-1" },
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor).toEqual({
      ...mockInteractiveContext("auth-user-teacher", createdAt),
      kind: "teacher",
      actorId: "ci-t1",
      schoolId: "school-1",
      teacherId: "ci-t1",
      teacherScope: {
        teaching: { classSubjectIds: ["ci-cs-6a-math"] },
        homeroom: { classGroupIds: [] },
      },
    });
  });

  it("should resolve teacher when X-Actor-Kind is teacher and staff also exists", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValue({
      user: { id: "auth-user-multi" },
      session: { createdAt },
    } as any);

    const mockStaff = {
      id: "ci-st3",
      schoolId: "school-1",
      subjectId: "auth-user-multi",
      isActive: true,
    };
    const mockTeacher = {
      id: "ci-t1",
      schoolId: "school-1",
      subjectId: "auth-user-multi",
      isActive: true,
    };
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValue(mockStaff),
        findById: mock().mockResolvedValue(mockStaff),
      },
      staffAssignments: { list: mock().mockResolvedValue([]) },
      ...mockAccessControlForStaff("ci-st3", "school-1"),
      guardians: { findOne: mock().mockResolvedValue(null) },
      students: { findOne: mock().mockResolvedValue(null) },
      teachers: {
        findOne: mock().mockResolvedValue(mockTeacher),
        findById: mock().mockResolvedValue(mockTeacher),
      },
      teacherAssignments: {
        list: mock().mockResolvedValue([
          {
            id: "ta-1",
            teacherId: "ci-t1",
            academicYearId: "year-1",
            kind: "subject",
            classSubjectId: "ci-cs-6a-math",
            status: "active",
          },
        ]),
      },
      academicYears: {
        findOne: mock().mockResolvedValue({ id: "year-1", schoolId: "school-1", isActive: true }),
      },
    };

    const app = setupMockApp(mockRepos);
    const staffRes = await app.request("/test-protected", {
      headers: {
        "x-actor-kind": "staff",
        "x-school-id": "school-1",
        "x-academic-year-id": "year-1",
      },
    });
    const teacherRes = await app.request("/test-protected", {
      headers: {
        "x-actor-kind": "teacher",
        "x-school-id": "school-1",
        "x-academic-year-id": "year-1",
      },
    });

    const staffBody = (await staffRes.json()) as any;
    const teacherBody = (await teacherRes.json()) as any;

    expect(staffBody.actor?.kind).toBe("staff");
    expect(staffBody.actor?.staffMemberId).toBe("ci-st3");
    expect(teacherBody.actor?.kind).toBe("teacher");
    expect(teacherBody.actor?.teacherId).toBe("ci-t1");
  });

  it("should resolve staff when X-Actor-Kind is set and guardian also exists", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValueOnce({
      user: { id: "auth-user-multi" },
      session: { createdAt },
    } as any);

    const mockStaff = {
      id: "staff-1",
      schoolId: "school-1",
      subjectId: "auth-user-multi",
      isActive: true,
    };
    const mockGuardian = {
      id: "guardian-1",
      schoolId: "school-1",
      subjectId: "auth-user-multi",
    };
    const resolveActorGrants = mock().mockResolvedValue({
      permissions: new Set(),
      scopeGrants: [],
      isElevated: false,
    });
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValue(mockStaff),
        findById: mock().mockResolvedValue(mockStaff),
      },
      staffAssignments: { list: mock().mockResolvedValue([]) },
      ...mockAccessControlForStaff("staff-1", "school-1"),
      guardians: {
        findOne: mock().mockResolvedValue(mockGuardian),
        findById: mock().mockResolvedValue(mockGuardian),
      },
      guardianLinks: { list: mock().mockResolvedValue([]) },
      students: { findOne: mock().mockResolvedValue(null) },
      authorization: { resolveActorGrants },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected", {
      headers: {
        "x-actor-kind": "staff",
        "x-school-id": "school-1",
      },
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.actor?.kind).toBe("staff");
    expect(body.actor?.staffMemberId).toBe("staff-1");
    expect(resolveActorGrants).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "staff-1",
      actorType: "staff",
      schoolId: "school-1",
    }));
  });

  it("should pass X-Academic-Year-Id to grant resolution for staff actors", async () => {
    const createdAt = new Date().toISOString();
    getSession.mockResolvedValueOnce({
      user: { id: "auth-user-year" },
      session: { id: "session-year", createdAt },
    } as any);

    const resolveActorGrants = mock().mockResolvedValue({
      permissions: new Set(),
      scopeGrants: [],
      isElevated: false,
    });
    const mockStaff = {
      id: "staff-year",
      schoolId: "school-1",
      roles: ["teacher"],
      isActive: true,
    };
    const mockRepos = {
      staffMembers: {
        findOne: mock().mockResolvedValue(mockStaff),
        findById: mock().mockResolvedValue(mockStaff),
      },
      staffAssignments: { list: mock().mockResolvedValue([]) },
      ...mockAccessControlForStaff("staff-year", "school-1"),
      guardians: { findOne: mock().mockResolvedValue(null) },
      students: { findOne: mock().mockResolvedValue(null) },
      authorization: { resolveActorGrants },
    };

    const app = setupMockApp(mockRepos);
    const res = await app.request("/test-protected", {
      headers: {
        "x-academic-year-id": "year-2026",
      },
    });

    expect(res.status).toBe(200);
    expect(resolveActorGrants).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "staff-year",
      actorType: "staff",
      schoolId: "school-1",
      academicYearId: "year-2026",
    }));
  });
});

function createMockRepos() {
  return {
    staffMembers: { findOne: mock() },
    guardians: { findOne: mock() },
    students: { findOne: mock() },
    teachers: { findOne: mock() },
  };
}

function mockAccessControlForStaff(
  staffId: string,
  schoolId: string,
  academicYearId = "year-2026",
  permissionOverrides: { endsAt?: Date } = {},
) {
  return {
    staffPermissionAssignments: {
      list: mock().mockResolvedValue(STAFF_TEACHING_WRITE_TEST_PERMISSIONS.map((permission, index) => ({
        id: `spa-${staffId}-${index}`,
        staffId,
        schoolId,
        academicYearId,
        permission,
        scopeIds: "class-1",
        status: "active",
        ...permissionOverrides,
      }))),
    },
  };
}
