import type { SchoolScopedActorMetadata } from "@edaya/authorization";
import type { DocumentRendererPort, StaffPermissionAssignmentInput } from "@edaya/core";
import { transactionContext } from "@edaya/adaptor-postgres";
import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createTeacherActorMetadata } from "@edaya/authorization";
import { Attachment, AttachmentOwnerKind, AttachmentStatus, GradeScale, noOpFileStorage, noOpNotificationGateway, Permission, ReportCardDefinition, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus, StaffPermissionAssignment } from "@edaya/core";
import { SchoolService } from "@edaya/service";
import { describe, expect, mock, onTestFinished, test } from "bun:test";
import { renderReportCardDocument } from "@/lib/documents/render-report-card-document";
import { createAuthorizationDatabase, seedAuthorizationRelationships } from "../../../../package/adaptor-postgres/tests/support/authorization-database";

const identity = { schoolId: "school-a", subjectId: "person-a", academicYearId: "year-a", requestId: "report-document", authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified };
const staff = createStaffActorMetadata({ ...identity, staffMemberId: "staff-a" });

async function fixture(actor: SchoolScopedActorMetadata = staff) {
  const { db, repositories, atomic } = await createAuthorizationDatabase();
  onTestFinished(() => db.close());
  await seedAuthorizationRelationships(db);
  await db.exec("UPDATE academic_periods SET is_published = true WHERE id = 'period-a'");
  await repositories.gradeScales.save(new GradeScale({ id: "scale", schoolId: "school-a", name: "20 points", minScore: 0, maxScore: 20, ranges: [{ letter: "A", minScore: 0, maxScore: 20, isPassing: true }] }));
  await repositories.definitions.save(new ReportCardDefinition({ id: "definition", schoolId: "school-a", academicYearId: "year-a", gradeLevelId: "level-a", gradeScaleId: "scale", name: "Report" }));
  const result = new ReportCardResult({
    id: "report",
    reportCardDefinitionId: "definition",
    studentId: "student-a",
    classGroupId: "class-a",
    periodId: "period-a",
    status: ReportCardResultStatus.Published,
    publishedAt: new Date(),
    assessmentResultCount: 1,
    overallAverage: 12,
    attendanceSummary: { presentCount: 20, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 },
    sectionResults: [new ReportCardResultSection({ sectionId: "math", sectionKind: ReportCardDefinitionSectionKind.Subject, name: "Math", average: 12, weight: 1, classSubjectId: "math-a" })],
  });
  await repositories.results.save(result);
  const putObject = mock(async () => {
    expect(transactionContext.getStore()).toBeUndefined();
    return { sizeBytes: 4096 };
  });
  const render = mock(async (_input: Parameters<DocumentRendererPort["render"]>[0]) => {
    expect(transactionContext.getStore()).toBeUndefined();
    return { bytes: new Uint8Array(4096), sha256: "abc123", renderId: "render-1", contentType: "application/pdf" };
  });
  const service = new SchoolService({ actor, repositories, atomicExecution: atomic, notificationGateway: noOpNotificationGateway, fileStorage: { ...noOpFileStorage, putObject } });
  const grant = async (extra: Partial<StaffPermissionAssignmentInput> = {}) => repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "grant", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.REPORT_CARD_PUBLISH, scopes: [{ kind: "school" }], ...extra }));
  const generate = () => renderReportCardDocument(service, { resultId: "report", renderer: { render }, locale: "en" });
  const attachment = async (sizeBytes = 4096) => repositories.attachments.save(new Attachment({ id: "existing", schoolId: "school-a", ownerKind: AttachmentOwnerKind.ReportCard, ownerId: "report", fileName: "report.pdf", storageKey: "report.pdf", status: AttachmentStatus.Ready, sizeBytes, mimeType: "application/pdf" }));
  return { db, repositories, atomic, result, service, putObject, render, grant, generate, attachment };
}

describe("report document publication policy", () => {
  test("publication grant renders and stores without an unrelated attachment grant", async () => {
    const f = await fixture();
    await f.grant();
    const outcome = await f.generate();
    const saved = await f.repositories.attachments.findById(outcome!.attachmentId);
    expect(saved?.ownerId).toBe("report");
    expect(saved?.uploadedById).toBe("staff-a");
    expect(saved?.status).toBe(AttachmentStatus.Ready);
    expect(f.render).toHaveBeenCalledTimes(1);
    expect(f.putObject).toHaveBeenCalledTimes(1);
  });

  test("reviewed republication renders a new PDF and retains the old attachment", async () => {
    const f = await fixture();
    await f.grant();
    await f.repositories.attachments.save(new Attachment({ id: "old-publication", schoolId: "school-a", ownerKind: AttachmentOwnerKind.ReportCard, ownerId: "report", fileName: "old.pdf", storageKey: "old.pdf", status: AttachmentStatus.Ready, sizeBytes: 4096, mimeType: "application/pdf", createdAt: new Date(Date.now() - 60_000) }));
    await f.repositories.results.save(new ReportCardResult({ ...f.result.data, sectionResults: [...f.result.sectionResults], publishedAt: new Date(), version: f.result.version + 1, publicationHistory: [{ ...f.result.data, sectionResults: [...f.result.sectionResults] }] }));
    const outcome = await f.generate();
    expect(outcome?.attachmentId).not.toBe("old-publication");
    expect(f.render).toHaveBeenCalledTimes(1);
    expect((await f.repositories.attachments.findById("old-publication"))?.status).toBe(AttachmentStatus.Ready);
    expect(await f.generate()).toEqual(outcome);
    expect(f.render).toHaveBeenCalledTimes(1);
  });

  test("cached PDF still requires current authority and selected year", async () => {
    const f = await fixture();
    await f.attachment();
    await expect(f.generate()).rejects.toThrow();
    await f.grant();
    expect(await f.generate()).toEqual({ attachmentId: "existing", storageKey: "report.pdf" });
    await f.grant({ endsAt: new Date("2000-01-01") });
    await expect(f.generate()).rejects.toThrow();
    await f.grant({ academicYearId: "year-old", scopes: [{ kind: "school" }] });
    await expect(f.generate()).rejects.toThrow();
    await f.repositories.staffPermissionAssignments.delete("grant");
    await expect(f.generate()).rejects.toThrow();
    expect(f.render).not.toHaveBeenCalled();
    expect(f.putObject).not.toHaveBeenCalled();
  });

  test("read and attachment actions cannot substitute for publication", async () => {
    const f = await fixture();
    await f.grant({ id: "read", permission: Permission.REPORT_CARD_READ, scopes: [{ kind: "school" }] });
    await f.grant({ id: "attachment", permission: Permission.ATTACHMENT_CONFIGURE, scopes: [{ kind: "school" }] });
    await expect(f.generate()).rejects.toThrow();
    expect(f.render).not.toHaveBeenCalled();
    expect(f.putObject).not.toHaveBeenCalled();
  });

  test("owner still cannot render an unpublished result or period", async () => {
    const f = await fixture();
    await f.db.exec("UPDATE schools SET owner_subject_id = 'person-a' WHERE id = 'school-a'");
    await f.attachment();
    await f.db.exec("UPDATE academic_periods SET is_published = false WHERE id = 'period-a'");
    await expect(f.generate()).rejects.toThrow("published result and academic period");
    await f.db.exec("UPDATE academic_periods SET is_published = true WHERE id = 'period-a'; UPDATE report_card_results SET status = 'draft', published_at = NULL WHERE id = 'report'");
    await expect(f.generate()).rejects.toThrow("published result and academic period");
    expect(f.render).not.toHaveBeenCalled();
  });

  for (const actor of [
    createGuardianActorMetadata({ ...identity, guardianId: "guardian-a" }),
    createTeacherActorMetadata({ ...identity, teacherId: "teacher-a" }),
    createStaffActorMetadata({ ...identity, schoolId: "school-b", subjectId: "person-b", staffMemberId: "staff-b", academicYearId: "year-b" }),
    createStaffActorMetadata({ ...identity, staffMemberId: "staff-a", assuranceLevel: ActorAssuranceLevel.Standard }),
  ]) {
    test(`rejects ${actor.kind}/${actor.schoolId}/${actor.assuranceLevel} despite the person's staff grant`, async () => {
      const f = await fixture(actor);
      await f.grant();
      await expect(f.generate()).rejects.toThrow();
      expect(f.render).not.toHaveBeenCalled();
      expect(f.putObject).not.toHaveBeenCalled();
    });
  }

  test("replaces stub PDF through publication policy and rolls changes back on render failure", async () => {
    const f = await fixture();
    await f.grant();
    await f.attachment(100);
    f.render.mockRejectedValueOnce(new Error("Renderer unavailable"));
    await expect(f.generate()).rejects.toThrow("REPORT_DOCUMENT_RENDER_UNAVAILABLE");
    expect((await f.repositories.attachments.findById("existing"))?.status).toBe(AttachmentStatus.Ready);
    expect(f.putObject).not.toHaveBeenCalled();
    await f.generate();
    expect((await f.repositories.attachments.findById("existing"))?.status).toBe(AttachmentStatus.Failed);
  });

  test("rechecks authority after rendering before uploading", async () => {
    const f = await fixture();
    await f.grant();
    f.render.mockImplementationOnce(async () => {
      await f.repositories.staffPermissionAssignments.delete("grant");
      return { bytes: new Uint8Array(4096), sha256: "abc123", renderId: "render-1", contentType: "application/pdf" };
    });
    await expect(f.generate()).rejects.toThrow();
    expect(f.putObject).not.toHaveBeenCalled();
    expect(await f.repositories.attachments.list()).toEqual([]);
  });

  test("revocation while storing cannot publish or mark a stub failed", async () => {
    const f = await fixture();
    await f.grant();
    await f.attachment(100);
    f.putObject.mockImplementationOnce(async () => {
      expect(transactionContext.getStore()).toBeUndefined();
      await f.repositories.staffPermissionAssignments.delete("grant");
      return { sizeBytes: 4096 };
    });
    await expect(f.generate()).rejects.toThrow();
    expect((await f.repositories.attachments.list()).map(value => [value.id, value.status])).toEqual([["existing", AttachmentStatus.Ready]]);
  });

  for (const during of ["render", "storage"] as const) {
    for (const update of [
      "UPDATE report_card_results SET overall_average = 13 WHERE id = 'report'",
      "UPDATE students SET first_name = 'Changed' WHERE id = 'student-a'",
      "UPDATE teacher_assignments SET status = 'ended' WHERE id = 'teaching'",
      "UPDATE schools SET name = 'Changed' WHERE id = 'school-a'",
    ]) {
      test(`rejects source changes during ${during}: ${update}`, async () => {
        const f = await fixture();
        await f.grant();
        await f.attachment(100);
        if (during === "render") {
          f.render.mockImplementationOnce(async () => {
            await f.db.exec(update);
            return { bytes: new Uint8Array(4096), sha256: "abc123", renderId: "render-1", contentType: "application/pdf" };
          });
        }
        else {
          f.putObject.mockImplementationOnce(async () => {
            await f.db.exec(update);
            return { sizeBytes: 4096 };
          });
        }
        await expect(f.generate()).rejects.toMatchObject({ code: "REPORT_DOCUMENT_SOURCE_CHANGED" });
        expect((await f.repositories.attachments.list()).map(value => [value.id, value.status])).toEqual([["existing", AttachmentStatus.Ready]]);
        if (during === "render") {
          expect(f.putObject).not.toHaveBeenCalled();
        }
        await expect(f.generate()).resolves.toHaveProperty("attachmentId");
        expect((await f.repositories.attachments.findById("existing"))?.status).toBe(AttachmentStatus.Failed);
      });
    }
  }

  test("unpublication while storing invalidates completion", async () => {
    const f = await fixture();
    await f.grant();
    f.putObject.mockImplementationOnce(async () => {
      await f.db.exec("UPDATE academic_periods SET is_published = false WHERE id = 'period-a'");
      return { sizeBytes: 4096 };
    });
    await expect(f.generate()).rejects.toMatchObject({ code: "REPORT_DOCUMENT_UNPUBLISHED" });
    expect(await f.repositories.attachments.list()).toEqual([]);
  });

  test("storage failure preserves the previous stub for a later successful retry", async () => {
    const f = await fixture();
    await f.grant();
    await f.attachment(100);
    f.putObject.mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(f.generate()).rejects.toThrow("REPORT_DOCUMENT_STORAGE_UNAVAILABLE");
    expect((await f.repositories.attachments.findById("existing"))?.status).toBe(AttachmentStatus.Ready);
    await expect(f.generate()).resolves.toHaveProperty("attachmentId");
    expect((await f.repositories.attachments.findById("existing"))?.status).toBe(AttachmentStatus.Failed);
  });

  test("empty published shells do not render", async () => {
    const f = await fixture();
    await f.grant();
    await f.repositories.results.save(new ReportCardResult({ ...f.result.data, sectionResults: [] }));
    expect(await f.generate()).toBeNull();
    expect(f.render).not.toHaveBeenCalled();
  });

  test("statistics include only the published cohort", async () => {
    const f = await fixture();
    await f.grant();
    await f.repositories.results.save(new ReportCardResult({ ...f.result.data, sectionResults: [...f.result.sectionResults], id: "peer", studentId: "student-other", overallAverage: 18 }));
    await f.repositories.results.save(new ReportCardResult({ ...f.result.data, sectionResults: [...f.result.sectionResults], id: "draft", status: ReportCardResultStatus.Draft, publishedAt: undefined, overallAverage: 0 }));
    await f.generate();
    expect(f.render.mock.calls[0]![0].payload).toMatchObject({ classResults: { classAverage: "15.00 / 20", lowestAverage: "12.00 / 20", highestAverage: "18.00 / 20" } });
  });

  test("teacher names use current assignments and never a staff coordinator fallback", async () => {
    const f = await fixture();
    await f.grant();
    await f.db.exec("UPDATE class_groups SET homeroom_staff_id = 'staff-a' WHERE id = 'class-a'");
    let context = await f.service.baseService.access.reportCards.documentContext("report");
    expect(context.homeroomTeacherName).toBeUndefined();
    expect(context.teacherNameByClassSubjectId.get("math-a")).toBe("A Teacher");
    await f.db.exec("INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, kind, class_group_id, status, created_at) VALUES ('homeroom', 'teacher-a', 'year-a', 'homeroom', 'class-a', 'active', now())");
    context = await f.service.baseService.access.reportCards.documentContext("report");
    expect(context.homeroomTeacherName).toBe("A Teacher");
    for (const change of ["starts_at = '2999-01-01'", "starts_at = NULL, ends_at = '2000-01-01'", "ends_at = NULL, academic_year_id = 'year-old'", "academic_year_id = 'year-a', status = 'ended', ends_at = '2999-01-01'"]) {
      await f.db.exec(`UPDATE teacher_assignments SET ${change}`);
      context = await f.service.baseService.access.reportCards.documentContext("report");
      expect(context.homeroomTeacherName).toBeUndefined();
      expect(context.teacherNameByClassSubjectId.size).toBe(0);
    }
  });

  test("rejects report subjects from another class and attachment reassignment", async () => {
    const f = await fixture();
    await f.grant();
    await f.attachment();
    const attachment = (await f.repositories.attachments.findById("existing"))!;
    await expect(f.atomic.execute(() => f.service.baseService.access.reportCards.assertDocumentAttachment("report", new Attachment({ ...attachment.data, ownerId: "another-report" })))).rejects.toThrow();
    await f.repositories.results.save(new ReportCardResult({ ...f.result.data, sectionResults: [new ReportCardResultSection({ ...f.result.sectionResults[0]!.data, classSubjectId: "math-other" })] }));
    await expect(f.generate()).rejects.toThrow("another class");
    expect(f.render).not.toHaveBeenCalled();
  });
});
