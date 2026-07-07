import { describe, expect, test } from "bun:test";
import {
  ActorAssuranceLevel,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  createTeacherActorMetadata,
  EMPTY_TEACHER_SCOPE,
  Permission,
} from "@edaya/core";
import {
  requireInteractiveActor,
  serializeActorAuthorization,
  serializeEffectiveGrants,
} from "@/lib/authorization/serialize-grants";

describe("serializeEffectiveGrants", () => {
  test("serializes scopeIdsByPermission without deriving scopeGrants", () => {
    const serialized = serializeEffectiveGrants({
      permissions: new Set([Permission.QUERY_STUDENT_DETAIL_READ]),
      scopeGrants: [],
      scopeIdsByPermission: {
        [Permission.QUERY_STUDENT_DETAIL_READ]: "s1,s2",
      },
      isElevated: false,
    });

    expect(serialized.scopeIdsByPermission).toEqual({
      QUERY_STUDENT_DETAIL_READ: "s1,s2",
    });
    expect(serialized.scopeGrants).toEqual([]);
  });

  test("passes through persisted scopeGrants", () => {
    const serialized = serializeEffectiveGrants({
      permissions: new Set([Permission.STUDENT_READ]),
      scopeGrants: [{
        permission: Permission.STUDENT_READ,
        scopeType: "school",
        scopeEntityIds: ["school-1"],
      }],
      scopeIdsByPermission: {},
      isElevated: false,
    });

    expect(serialized.scopeGrants).toEqual([{
      permission: Permission.STUDENT_READ,
      scopeType: "school",
      scopeEntityIds: ["school-1"],
    }]);
    expect(serialized.scopeIdsByPermission).toEqual({});
  });

  test("serializes expiresAt when present on effective grants", () => {
    const serialized = serializeEffectiveGrants({
      permissions: new Set([Permission.STUDENT_READ]),
      scopeGrants: [],
      scopeIdsByPermission: {},
      isElevated: true,
      expiresAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(serialized.isElevated).toBe(true);
    expect(serialized.expiresAt).toBe("2026-06-01T12:00:00.000Z");
  });
});

describe("serializeActorAuthorization", () => {
  const base = {
    schoolId: "school-1",
    subjectId: "auth-subject",
    requestId: "req-1",
    authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
    assuranceLevel: ActorAssuranceLevel.Standard,
  };

  test("includes guardian capabilities and linked scope", () => {
    const serialized = serializeActorAuthorization(createGuardianActorMetadata({
      ...base,
      guardianId: "guardian-1",
      guardianScope: {
        studentIds: ["student-1"],
        classGroupIds: ["class-1"],
      },
    }));

    expect(serialized.kind).toBe("guardian");
    expect(serialized.capabilities?.length).toBeGreaterThan(0);
    expect(serialized.scope).toEqual({
      studentIds: ["student-1"],
      classGroupIds: ["class-1"],
    });
  });

  test("includes student and teacher portal scope shapes", () => {
    const student = serializeActorAuthorization(createStudentActorMetadata({
      ...base,
      studentId: "student-1",
      studentScope: {
        studentId: "student-1",
        classGroupId: "class-1",
      },
    }));
    expect(student.scope).toEqual({
      studentId: "student-1",
      classGroupId: "class-1",
    });

    const teacher = serializeActorAuthorization(createTeacherActorMetadata({
      ...base,
      teacherId: "teacher-1",
      teacherScope: EMPTY_TEACHER_SCOPE,
    }));
    expect(teacher.scope).toEqual({
      teaching: { classSubjectIds: [] },
      homeroom: { classGroupIds: [] },
    });
  });

  test("returns staff authorization without portal capabilities", () => {
    const serialized = serializeActorAuthorization(createStaffActorMetadata({
      ...base,
      staffMemberId: "staff-1",
      effectiveGrants: {
        permissions: new Set<Permission>(),
        scopeGrants: [],
        scopeIdsByPermission: {},
        isElevated: false,
      },
    }));

    expect(serialized.kind).toBe("staff");
    expect(serialized.capabilities).toBeUndefined();
    expect(serialized.scope).toBeUndefined();
  });
});

describe("requireInteractiveActor", () => {
  test("returns interactive actors and rejects non-interactive metadata", () => {
    expect(requireInteractiveActor(createStaffActorMetadata({
      schoolId: "school-1",
      subjectId: "auth-subject",
      requestId: "req-1",
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
      assuranceLevel: ActorAssuranceLevel.Standard,
      staffMemberId: "staff-1",
      effectiveGrants: {
        permissions: new Set<Permission>(),
        scopeGrants: [],
        scopeIdsByPermission: {},
        isElevated: false,
      },
    }))?.kind).toBe("staff");
    expect(requireInteractiveActor(null)).toBeNull();
    expect(requireInteractiveActor({ kind: "system" })).toBeNull();
  });
});
