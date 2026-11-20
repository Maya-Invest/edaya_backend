import {
  ActorAssuranceLevel,
  createGuardianActorMetadata,
  createPlatformActorMetadata,
  createStaffActorMetadata,
  createSystemActorMetadata,
} from "@edaya/authorization";
import { Permission, StaffPermissionAssignment } from "@edaya/core";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  requireInteractiveActor,
  requireSchoolInteractiveActor,
  serializeActorAuthorization,
} from "@/lib/authorization/serialize-grants";
import { usePooledDatabases } from "../../../../package/adaptor-postgres/tests/support/pooled-database";

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases();

describe("authorization display serialization", () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>;
  const staff = createStaffActorMetadata({ schoolId: "school-a", staffMemberId: "staff-a", subjectId: "person-a", requestId: "test", authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified });
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase();
  });
  afterEach(async () => {
    await releaseDatabase(fixture.db);
  });

  test("serializes canonical actions, typed placement and validity from live manual grants", async () => {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: "grant",
      schoolId: "school-a",
      staffId: "staff-a",
      academicYearId: "year-a",
      permission: Permission.GRADE_READ,
      scopes: [{ kind: "class_group", classGroupId: "class-a" }],
      startsAt: new Date("2000-01-01"),
      endsAt: new Date("2100-01-01"),
    }));
    expect(await serializeActorAuthorization(staff, fixture.repositories)).toEqual({
      kind: "staff",
      actorId: "staff-a",
      schoolId: "school-a",
      assuranceLevel: ActorAssuranceLevel.Verified,
      grants: [{ permission: Permission.GRADE_READ, scopes: [{ kind: "class_group", classGroupId: "class-a" }], academicYearId: "year-a", startsAt: "2000-01-01T00:00:00.000Z", endsAt: "2100-01-01T00:00:00.000Z", source: "manual" }, { permission: Permission.WORKSPACE_ACCESS, scopes: [{ kind: "school" }], source: "relationship" }],
    });
    await fixture.repositories.staffPermissionAssignments.delete("grant");
    expect((await serializeActorAuthorization(staff, fixture.repositories)).grants).toEqual([{ permission: Permission.WORKSPACE_ACCESS, scopes: [{ kind: "school" }], source: "relationship" }]);
  });

  test("owner display excludes platform authority and a guardian profile retains only its own relationships", async () => {
    await fixture.db.exec(`UPDATE schools SET owner_subject_id = 'person-a' WHERE id = 'school-a';
      INSERT INTO students (id, identifier, school_id, first_name, last_name, status, created_at) VALUES ('student', 'STUDENT', 'school-a', 'S', 'One', 'active', now());
      INSERT INTO guardians (id, identifier, school_id, first_name, last_name, subject_id, has_access, created_at)
        VALUES ('guardian', 'GUARDIAN', 'school-a', 'G', 'One', 'person-a', true, now());
      INSERT INTO guardian_student_links (id, school_id, guardian_id, student_id, relationship, is_primary, created_at)
        VALUES ('link', 'school-a', 'guardian', 'student', 'parent', true, now());`);
    const owner = await serializeActorAuthorization(staff, fixture.repositories);
    expect(owner.grants.some(grant => grant.permission === Permission.GRADE_MANAGE)).toBe(true);
    expect(owner.grants.some(grant => grant.permission === Permission.PLATFORM_USER_MANAGE)).toBe(false);
    const guardian = createGuardianActorMetadata({ schoolId: "school-a", guardianId: "guardian", subjectId: "person-a", requestId: "test", authenticatedAt: new Date() });
    const family = await serializeActorAuthorization(guardian, fixture.repositories);
    expect(family.grants.some(grant => grant.permission === Permission.GRADE_MANAGE)).toBe(false);
    expect(family.grants.find(grant => grant.permission === Permission.STUDENT_READ)?.scopes).toEqual([{ kind: "student", studentId: "student" }]);
    await fixture.db.exec("DELETE FROM guardian_student_links");
    expect((await serializeActorAuthorization(guardian, fixture.repositories)).grants).toEqual([]);
  });

  test("school snapshots exclude platform and job identities", () => {
    const platform = createPlatformActorMetadata({ actorId: "operator", subjectId: "operator", email: "op@example.test", requestId: "test", authenticatedAt: new Date() });
    const job = createSystemActorMetadata({ schoolId: "school-a", systemId: "cron", requestId: "job", reason: "test" });
    expect(requireInteractiveActor(platform)).toBe(platform);
    expect(requireSchoolInteractiveActor(platform)).toBeNull();
    expect(requireInteractiveActor(job)).toBeNull();
    expect(requireSchoolInteractiveActor(staff)).toBe(staff);
    expect(requireInteractiveActor(null)).toBeNull();
  });
});
