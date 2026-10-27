import { PostgresCommandJournal, PostgresDurableWork } from "@edaya/adaptor-postgres";
import { ActorAssuranceLevel, createStaffActorMetadata, createTeacherActorMetadata } from "@edaya/authorization";
import { LessonSession, noOpFileStorage, noOpNotificationGateway, Permission, StaffPermissionAssignment } from "@edaya/core";
import { SchoolApplication } from "@edaya/service";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { seedAuthorizationRelationships } from "../../../../package/adaptor-postgres/tests/support/authorization-database";
import { usePooledDatabases } from "../../../../package/adaptor-postgres/tests/support/pooled-database";

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases();

describe("logbook issuance uses native authorization scopes", () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>;
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase();
    await seedAuthorizationRelationships(fixture.db);
    for (const classSubjectId of ["math-a", "french-a"]) {
      await fixture.repositories.lessonSessions.save(new LessonSession({ id: `lesson-${classSubjectId}`, schoolId: "school-a", classGroupId: "class-a", classSubjectId, startsAt: new Date("2026-05-01T09:00:00Z"), endsAt: new Date("2026-05-01T10:00:00Z"), displayLabel: classSubjectId, sessionNote: `Private ${classSubjectId} notes` }));
    }
  });
  afterEach(async () => {
    await releaseDatabase(fixture.db);
  });

  function application() {
    return new SchoolApplication({
      repositories: fixture.repositories,
      atomicExecution: fixture.atomic,
      commandJournal: new PostgresCommandJournal(),
      durableWork: new PostgresDurableWork(fixture.connection),
      notificationGateway: noOpNotificationGateway,
      fileStorage: noOpFileStorage,
    });
  }

  const request = (service: ReturnType<SchoolApplication["forActor"]>, extra: { classGroupId?: string; classSubjectId?: string } = {}) => service.documentsWorkflow.requestDocumentIssuance({
    requestId: crypto.randomUUID(),
    templateKey: "logbook.v1",
    sourceId: extra.classGroupId ?? "class-a",
    classSubjectId: extra.classSubjectId,
    locale: "en",
  });

  test("subject teacher snapshot excludes unrelated subjects and cannot name a foreign class", async () => {
    const teacher = createTeacherActorMetadata({ schoolId: "school-a", teacherId: "teacher-a", subjectId: "person-a", requestId: "export", authenticatedAt: new Date() });
    const service = application().forActor(teacher);
    const result = await request(service);
    const stored = await fixture.repositories.documentIssuances.findById(result.id);
    const payload = JSON.stringify(stored?.snapshot.facts);
    expect(payload).toContain("Private math-a notes");
    expect(payload).not.toContain("Private french-a notes");
    for (const classGroupId of ["class-other", "class-b"])
      await expect(request(service, { classGroupId })).rejects.toThrow();
    await expect(request(service, { classGroupId: "class-a", classSubjectId: "french-a" })).rejects.toThrow();
  });

  test("a class-scoped staff read grant issues that class without requiring school-wide authority", async () => {
    const staff = createStaffActorMetadata({ schoolId: "school-a", staffMemberId: "staff-a", subjectId: "person-a", requestId: "export", authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified });
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "logbook", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.CLASS_LOGBOOK_READ, scopes: [{ kind: "class_group", classGroupId: "class-a" }] }));
    const service = application().forActor(staff);
    const result = await request(service);
    expect((await fixture.repositories.documentIssuances.findById(result.id))?.snapshot.facts).toMatchObject({ summary: { subjectCount: 2, sessionCount: 2 } });
    await fixture.repositories.staffPermissionAssignments.delete("logbook");
    await expect(request(service)).rejects.toThrow();
  });
});
