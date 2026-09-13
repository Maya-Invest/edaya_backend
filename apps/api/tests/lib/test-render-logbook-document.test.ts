import type { SchoolScopedActorMetadata } from "@edaya/authorization";
import type { DocumentRendererPort, StaffPermissionAssignmentInput } from "@edaya/core";
import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createTeacherActorMetadata } from "@edaya/authorization";
import { LessonSession, noOpFileStorage, noOpNotificationGateway, Permission, StaffAssignment, StaffPermissionAssignment } from "@edaya/core";
import { SchoolService } from "@edaya/service";
import { describe, expect, mock, onTestFinished, test } from "bun:test";
import { createAuthorizationDatabase, seedAuthorizationRelationships } from "../../../../package/adaptor-postgres/tests/support/authorization-database";
import { renderClassLogbookDocument } from "@/lib/documents/render-logbook-document";

const identity = { schoolId: "school-a", subjectId: "person-a", academicYearId: "year-a", requestId: "logbook-document", authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified };
const staff = createStaffActorMetadata({ ...identity, staffMemberId: "staff-a" });

async function fixture(actor: SchoolScopedActorMetadata = staff) {
  const { db, repositories, atomic } = await createAuthorizationDatabase();
  onTestFinished(() => db.close());
  await seedAuthorizationRelationships(db);
  for (const [id, classGroupId, classSubjectId, note] of [["math", "class-a", "math-a", "Math lesson"], ["french", "class-a", "french-a", "French lesson"], ["other", "class-other", "math-other", "Other class"], ["foreign", "class-b", "math-b", "Foreign class"]]) {
    await repositories.lessonSessions.save(new LessonSession({ id: id!, schoolId: id === "foreign" ? "school-b" : "school-a", classGroupId: classGroupId!, classSubjectId: classSubjectId!, displayLabel: note!, sessionNote: note!, startsAt: new Date("2026-05-01T08:00:00Z"), endsAt: new Date("2026-05-01T09:00:00Z") }));
  }
  const putObject = mock(async () => ({ sizeBytes: 4096 }));
  const createPresignedDownload = mock(async () => ({ downloadUrl: "https://example.test/logbook.pdf", expiresAt: new Date("2026-10-01") }));
  const render = mock(async (_input: Parameters<DocumentRendererPort["render"]>[0]) => ({ bytes: new Uint8Array(4096), sha256: "abc123", renderId: "render-1", contentType: "application/pdf" }));
  const service = new SchoolService({ actor, repositories, atomicExecution: atomic, notificationGateway: noOpNotificationGateway, fileStorage: { ...noOpFileStorage, putObject, createPresignedDownload } });
  const grant = async (extra: Partial<StaffPermissionAssignmentInput> = {}) => repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "grant", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.CLASS_LOGBOOK_READ, scopes: [{ kind: "class_group", classGroupId: "class-a" }], ...extra }));
  const generate = (extra: { classGroupId?: string; classSubjectId?: string; academicPeriodId?: string } = {}) => renderClassLogbookDocument(service, { classGroupId: "class-a", academicPeriodId: "period-a", ...extra, renderer: { render }, locale: "en" });
  return { db, repositories, service, putObject, createPresignedDownload, render, grant, generate };
}

describe("logbook document policy", () => {
  test("scoped staff export only the permitted class and its counts", async () => {
    const f = await fixture();
    await f.grant();
    const outcome = await f.generate();
    expect(outcome.subjectCount).toBe(2);
    expect(outcome.sessionCount).toBe(2);
    expect(outcome.downloadUrl).toBe("https://example.test/logbook.pdf");
    const payload = JSON.stringify(f.render.mock.calls[0]![0].payload);
    expect(payload).toContain("Math lesson");
    expect(payload).toContain("A Teacher");
    expect(payload).toContain("French lesson");
    expect(payload).not.toContain("Other class");
    expect(payload).not.toContain("Foreign class");
  });

  test("unrelated actions, classes, subjects and periods cannot broaden the export", async () => {
    const f = await fixture();
    await f.grant({ permission: Permission.CLASS_LOGBOOK_UPDATE });
    await expect(f.generate()).rejects.toThrow();
    await f.grant();
    for (const input of [{ classGroupId: "class-other" }, { classGroupId: "class-b" }, { classSubjectId: "math-other" }, { academicPeriodId: "period-b" }]) {
      await expect(f.generate(input)).rejects.toThrow();
    }
    expect(f.render).not.toHaveBeenCalled();
    expect(f.putObject).not.toHaveBeenCalled();
  });

  test("expired grants and a different selected academic year deny exports", async () => {
    const f = await fixture();
    await f.grant({ endsAt: new Date("2000-01-01") });
    await expect(f.generate()).rejects.toThrow();
    await f.grant({ academicYearId: "year-old", scopes: [{ kind: "class_group", classGroupId: "class-old" }] });
    await expect(f.generate()).rejects.toThrow();
    expect(f.putObject).not.toHaveBeenCalled();
  });

  test("subject teacher uses live assignments and loses access immediately on removal", async () => {
    const f = await fixture(createTeacherActorMetadata({ ...identity, teacherId: "teacher-a" }));
    expect((await f.generate()).subjectCount).toBe(1);
    await f.repositories.teacherAssignments.delete("teaching");
    await expect(f.generate()).rejects.toThrow();
    expect(f.render).toHaveBeenCalledTimes(1);
  });

  test("homeroom assignment alone cannot read a subject logbook", async () => {
    const f = await fixture(createTeacherActorMetadata({ ...identity, teacherId: "teacher-a" }));
    await f.db.exec("UPDATE teacher_assignments SET kind = 'homeroom', class_subject_id = NULL, class_group_id = 'class-a'");
    await expect(f.generate()).rejects.toThrow();
    expect(f.render).not.toHaveBeenCalled();
  });

  test("guardian selection uses current child enrollment and never borrows staff grants", async () => {
    const f = await fixture(createGuardianActorMetadata({ ...identity, guardianId: "guardian-a" }));
    await f.grant({ scopes: [{ kind: "class_group", classGroupId: "class-other" }] });
    expect((await f.generate()).subjectCount).toBe(2);
    await expect(f.generate({ classGroupId: "class-other" })).rejects.toThrow();
    await f.repositories.guardianLinks.delete("guardian-link");
    await expect(f.generate()).rejects.toThrow();
    expect(f.render).toHaveBeenCalledTimes(1);
  });

  test("teacher names exclude inactive assignments and never use staff responsibility labels", async () => {
    const f = await fixture();
    await f.grant();
    await f.db.exec("UPDATE teacher_assignments SET ends_at = '2000-01-01'");
    await f.repositories.staffAssignments.save(new StaffAssignment({ id: "staff-teacher", staffId: "staff-a", academicYearId: "year-a", responsibility: "Teacher", permissions: [], classSubjectId: "math-a" }));
    await f.generate();
    const payload = JSON.stringify(f.render.mock.calls[0]![0].payload);
    expect(payload).not.toContain("A Teacher");
    expect(payload).not.toContain("A Staff");
  });

  test("empty content rejects before rendering or uploading", async () => {
    const f = await fixture();
    await f.grant();
    await f.db.exec("UPDATE lesson_sessions SET session_note = NULL");
    await expect(f.generate()).rejects.toMatchObject({ code: "LOGBOOK_EMPTY" });
    expect(f.render).not.toHaveBeenCalled();
    expect(f.putObject).not.toHaveBeenCalled();
  });

  test("relationship removal during rendering blocks upload and signing", async () => {
    const f = await fixture(createTeacherActorMetadata({ ...identity, teacherId: "teacher-a" }));
    f.render.mockImplementationOnce(async () => {
      await f.repositories.teacherAssignments.delete("teaching");
      return { bytes: new Uint8Array(4096), sha256: "abc123", renderId: "render-1", contentType: "application/pdf" };
    });
    await expect(f.generate()).rejects.toThrow();
    expect(f.putObject).not.toHaveBeenCalled();
    expect(f.createPresignedDownload).not.toHaveBeenCalled();
  });
});
