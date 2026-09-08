import { Buffer } from "node:buffer";
import {
  AttachmentOwnerKind,
  AttachmentStatus,
  AttendanceSummary,
  ReportCardDefinitionSectionKind,
  ReportCardResult,
  ReportCardResultSection,
  ReportCardResultStatus,
  School,
  Student,
} from "@edaya/core";
import { describe, expect, mock, test } from "bun:test";
import { createTestStaffActor } from "../support/staff-actor-fixture";
import { renderReportCardDocument } from "@/lib/documents/render-report-card-document";

describe("renderReportCardDocument", () => {
  const school = new School({
    id: "sch-1",
    name: "Lycée Test",
    timeZone: "Africa/Abidjan",
  });
  const student = new Student({
    id: "stu-1",
    schoolId: school.id,
    firstName: "Awa",
    lastName: "Kouassi",
  });
  const result = new ReportCardResult({
    id: "rc-1",
    reportCardDefinitionId: "def-1",
    studentId: student.id,
    classGroupId: "cg-1",
    periodId: "per-1",
    status: ReportCardResultStatus.Published,
    publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    assessmentResultCount: 1,
    overallAverage: 12,
    attendanceSummary: new AttendanceSummary({
      presentCount: 20,
      absenceCount: 0,
      lateCount: 0,
    }),
    sectionResults: [
      new ReportCardResultSection({
        sectionId: "sub-math",
        sectionKind: ReportCardDefinitionSectionKind.Subject,
        name: "Mathématiques",
        average: 12,
        weight: 2,
        classSubjectId: "cs-math",
      }),
    ],
  });

  test("renders inline PDF, stores object, and registers attachment", async () => {
    const putObject = mock(async () => ({ sizeBytes: 12 }));
    const saveAttachment = mock(async (attachment: { id: string }) => attachment);
    const render = mock(async () => ({
      renderId: "render-1",
      sha256: "abc123",
      bytes: new Uint8Array(Buffer.from("%PDF-1.4")),
      contentType: "application/pdf",
    }));

    const service = {
      baseService: {
        actor: createTestStaffActor(),
        repositories: {
          results: {
            findById: mock(async () => result),
            list: mock(async () => [result]),
          },
          attachments: { list: mock(async () => []) },
          students: { findById: mock(async () => student) },
          schools: { findById: mock(async () => school) },
          academicPeriods: {
            findById: mock(async () => ({ id: "per-1", name: "1er Trimestre", academicYearId: "year-1" })),
          },
          classGroups: { findById: mock(async () => ({ id: "cg-1", name: "1ère C" })) },
          academicYears: { findById: mock(async () => ({ id: "year-1", name: "2025-2026" })) },
          classSubjects: {
            findByIds: mock(async () => [{ id: "cs-math", subjectId: "subj-math" }]),
          },
          subjects: {
            findByIds: mock(async () => [{ id: "subj-math", name: "Mathématiques" }]),
          },
          teacherAssignments: { list: mock(async () => []) },
          teachers: { findById: mock(async () => null) },
          staffMembers: { list: mock(async () => []), findById: mock(async () => null) },
        },
        entities: {
          attachments: { save: saveAttachment },
        },
        fileStorage: { putObject },
      },
    };

    const outcome = await renderReportCardDocument(service as never, {
      resultId: result.id,
      renderer: { render },
    });

    expect(outcome?.storageKey).toContain(`${school.id}/generated/report-card/${AttachmentOwnerKind.ReportCard}/${result.id}/`);
    expect(render).toHaveBeenCalledTimes(1);
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(saveAttachment).toHaveBeenCalledTimes(1);
    const saved = saveAttachment.mock.calls[0]?.[0] as unknown as {
      ownerKind: AttachmentOwnerKind;
      ownerId: string;
      status: AttachmentStatus;
      mimeType: string;
      uploadedById?: string;
    };
    expect(saved.ownerKind).toBe(AttachmentOwnerKind.ReportCard);
    expect(saved.ownerId).toBe(result.id);
    expect(saved.status).toBe(AttachmentStatus.Ready);
    expect(saved.mimeType).toBe("application/pdf");
    expect(saved.uploadedById).toBe("staff-1");
  });

  test("skips render when a ready PDF attachment already exists", async () => {
    const render = mock(async () => {
      throw new Error("should not render");
    });
    const service = {
      baseService: {
        actor: createTestStaffActor(),
        repositories: {
          results: { findById: mock(async () => result) },
          attachments: {
            list: mock(async () => [{
              id: "att-existing",
              status: AttachmentStatus.Ready,
              mimeType: "application/pdf",
              storageKey: "sch-1/generated/report-card/report_card/rc-1/att-existing/bulletin.pdf",
            }]),
          },
        },
        entities: { attachments: { save: mock(async () => undefined) } },
        fileStorage: { putObject: mock(async () => ({ sizeBytes: 1 })) },
      },
    };

    const outcome = await renderReportCardDocument(service as never, {
      resultId: result.id,
      renderer: { render },
    });

    expect(outcome).toEqual({
      attachmentId: "att-existing",
      storageKey: "sch-1/generated/report-card/report_card/rc-1/att-existing/bulletin.pdf",
    });
    expect(render).not.toHaveBeenCalled();
  });

  test("skips render when the report card has no section results", async () => {
    const emptyResult = new ReportCardResult({
      id: "rc-empty",
      reportCardDefinitionId: "def-1",
      studentId: student.id,
      classGroupId: "cg-1",
      periodId: "per-1",
      status: ReportCardResultStatus.Published,
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      assessmentResultCount: 0,
      attendanceSummary: new AttendanceSummary({
        presentCount: 0,
        absenceCount: 0,
        lateCount: 0,
      }),
      sectionResults: [],
    });
    const render = mock(async () => {
      throw new Error("should not render");
    });
    const service = {
      baseService: {
        actor: createTestStaffActor(),
        repositories: {
          results: { findById: mock(async () => emptyResult) },
          attachments: { list: mock(async () => []) },
          students: { findById: mock(async () => student) },
          schools: { findById: mock(async () => school) },
          academicPeriods: {
            findById: mock(async () => ({ id: "per-1", name: "1er Trimestre", academicYearId: "year-1" })),
          },
          classGroups: { findById: mock(async () => ({ id: "cg-1", name: "1ère C" })) },
          academicYears: { findById: mock(async () => ({ id: "year-1", name: "2025-2026" })) },
        },
        entities: { attachments: { save: mock(async () => undefined) } },
        fileStorage: { putObject: mock(async () => ({ sizeBytes: 1 })) },
      },
    };

    await expect(renderReportCardDocument(service as never, {
      resultId: emptyResult.id,
      renderer: { render },
    })).resolves.toBeNull();
    expect(render).not.toHaveBeenCalled();
  });
});
