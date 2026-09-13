import { renderClassLogbookDocument } from "@/lib/documents/render-logbook-document";
import { ActorAssuranceLevel, createStaffActorMetadata, createTeacherActorMetadata } from "@edaya/authorization";
import { LessonSession, noOpNotificationGateway, Permission, StaffPermissionAssignment } from "@edaya/core";
import { SchoolApplication } from "@edaya/service";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createAuthorizationDatabase, seedAuthorizationRelationships } from "../../../../package/adaptor-postgres/tests/support/authorization-database";

describe("logbook export uses native authorization scopes", () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>;
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase();
    await seedAuthorizationRelationships(fixture.db);
    for (const classSubjectId of ["math-a", "french-a"]) {
      await fixture.repositories.lessonSessions.save(new LessonSession({ id: `lesson-${classSubjectId}`, schoolId: "school-a", classGroupId: "class-a", classSubjectId, startsAt: new Date("2026-05-01T09:00:00Z"), endsAt: new Date("2026-05-01T10:00:00Z"), displayLabel: classSubjectId, sessionNote: `Private ${classSubjectId} notes` }));
    }
  });
  afterEach(async () => {
    await fixture.db.close();
  });

  function application() {
    const unused = async (): Promise<never> => {
      throw new Error("Unexpected storage operation");
    };
    return new SchoolApplication({
      repositories: fixture.repositories,
      atomicExecution: fixture.atomic,
      notificationGateway: noOpNotificationGateway,
      fileStorage: {
        deleteObject: unused,
        headObject: unused,
        createPresignedUpload: unused,
        putObject: async () => ({ sizeBytes: 3 }),
        createPresignedDownload: async () => ({ downloadUrl: "https://storage.example/export.pdf", expiresAt: new Date("2026-12-01") }),
      },
    });
  }

  const renderer = () => ({ render: mock(async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: "application/pdf" as const, sha256: "test", renderId: "test" })) });
  test("subject teacher export excludes unrelated subjects and cannot name a foreign class", async () => {
    const teacher = createTeacherActorMetadata({ schoolId: "school-a", teacherId: "teacher-a", subjectId: "person-a", requestId: "export", authenticatedAt: new Date() });
    const service = application().forActor(teacher);
    const output = renderer();
    const result = await renderClassLogbookDocument(service, { classGroupId: "class-a", renderer: output, locale: "en" });
    expect(result.subjectCount).toBe(1);
    expect(result.sessionCount).toBe(1);
    const rendered = JSON.stringify(output.render.mock.calls);
    expect(rendered).toContain("Private math-a notes");
    expect(rendered).not.toContain("Private french-a notes");
    for (const classGroupId of ["class-other", "class-b"])
      await expect(renderClassLogbookDocument(service, { classGroupId, renderer: output })).rejects.toThrow();
    await expect(renderClassLogbookDocument(service, { classGroupId: "class-a", classSubjectId: "french-a", renderer: output })).rejects.toThrow();
    expect(output.render).toHaveBeenCalledTimes(1);
  });

  test("a class-scoped staff read grant exports that class without requiring school-wide authority", async () => {
    const staff = createStaffActorMetadata({ schoolId: "school-a", staffMemberId: "staff-a", subjectId: "person-a", requestId: "export", authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified });
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "logbook", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.CLASS_LOGBOOK_READ, scopes: [{ kind: "class_group", classGroupId: "class-a" }] }));
    const output = renderer();
    const service = application().forActor(staff);
    const result = await renderClassLogbookDocument(service, { classGroupId: "class-a", renderer: output });
    expect(result.subjectCount).toBe(2);
    expect(result.sessionCount).toBe(2);
    await fixture.repositories.staffPermissionAssignments.delete("logbook");
    await expect(renderClassLogbookDocument(service, { classGroupId: "class-a", renderer: output })).rejects.toThrow();
    expect(output.render).toHaveBeenCalledTimes(1);
  });
});
