import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import {
  Attachment,
  AttachmentOwnerKind,
  AttachmentStatus,
  TeacherAssignmentKind,
} from "@edaya/core";
import {
  buildReportCardV1Payload,
  buildStorageKey,
  type SchoolService,
} from "@edaya/service";
import {
  createDocsClient,
  createFetchTransport,
  type DocsClient,
} from "@maya-invest/edaya-docs-client";
import { issueDocsServiceToken } from "@/lib/documents/issue-docs-service-token";

function collectClassSubjectIds(
  sections: ReadonlyArray<{ classSubjectId?: string; subResults: ReadonlyArray<{ classSubjectId?: string; subResults: readonly unknown[] }> }>,
): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    if (section.classSubjectId) {
      ids.push(section.classSubjectId);
    }
    ids.push(...collectClassSubjectIds(section.subResults as typeof sections));
  }
  return [...new Set(ids)];
}

function formatClassAverage(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} / 20`;
}

export interface DocsRenderConfig {
  docsUrl: string;
  jwtSecret: string;
  /** When set, used as Bearer instead of issuing a JWT (local DOCS_DEV_TOKEN). */
  devToken?: string;
}

export interface RenderReportCardDocumentInput {
  resultId: string;
  config: DocsRenderConfig;
  locale?: string;
  createClient?: (config: DocsRenderConfig, schoolId: string) => DocsClient;
}

function defaultCreateClient(config: DocsRenderConfig, schoolId: string): DocsClient {
  // Prefer JWT so claims.schoolId matches the render request. DOCS_DEV_TOKEN is for
  // curl smoke tests only — docs maps it to fixed schoolId `sch_demo`.
  const authorization = config.jwtSecret
    ? `Bearer ${issueDocsServiceToken({ schoolId, secret: config.jwtSecret })}`
    : `Bearer ${config.devToken}`;

  return createDocsClient(createFetchTransport({
    baseUrl: config.docsUrl,
    getAuthorization: () => authorization,
  }));
}

/**
 * Loads a published report card, renders `report-card.v1` via edaya_docs (inline),
 * stores the PDF in school object storage, and registers an attachment.
 */
export async function renderReportCardDocument(
  service: SchoolService,
  input: RenderReportCardDocumentInput,
): Promise<{ attachmentId: string; storageKey: string } | null> {
  const result = await service.baseService.repositories.results.findById(input.resultId);
  if (!result) {
    throw new Error(`Report card result not found: ${input.resultId}`);
  }

  const existing = await service.baseService.repositories.attachments.list({
    ownerKind: AttachmentOwnerKind.ReportCard,
    ownerId: result.id,
  });
  // Skip tiny stub PDFs (~879 bytes when docs runs without Gotenberg/Browser Run).
  const readyPdf = existing.find(entry =>
    entry.status === AttachmentStatus.Ready
    && entry.mimeType === "application/pdf"
    && (entry.sizeBytes === undefined || entry.sizeBytes >= 2_048));
  if (readyPdf?.storageKey) {
    return { attachmentId: readyPdf.id, storageKey: readyPdf.storageKey };
  }
  const stubPdfs = existing.filter(entry =>
    entry.status === AttachmentStatus.Ready
    && entry.mimeType === "application/pdf"
    && entry.sizeBytes !== undefined
    && entry.sizeBytes < 2_048);
  for (const stub of stubPdfs) {
    await service.baseService.entities.attachments.save(new Attachment({
      id: stub.id,
      schoolId: stub.schoolId,
      ownerKind: stub.ownerKind,
      ownerId: stub.ownerId,
      fileName: stub.fileName,
      storageKey: stub.storageKey,
      fileUrl: stub.fileUrl,
      status: AttachmentStatus.Failed,
      checksum: stub.checksum,
      mimeType: stub.mimeType,
      sizeBytes: stub.sizeBytes,
      uploadedById: stub.uploadedById,
      createdAt: stub.createdAt,
    }), { moduleChecked: true });
  }

  const student = await service.baseService.repositories.students.findById(result.studentId);
  if (!student) {
    throw new Error(`Student not found for report card ${result.id}`);
  }
  const school = await service.baseService.repositories.schools.findById(student.schoolId);
  if (!school) {
    throw new Error(`School not found for report card ${result.id}`);
  }
  const period = await service.baseService.repositories.academicPeriods.findById(result.periodId);
  if (!period) {
    throw new Error(`Academic period not found for report card ${result.id}`);
  }
  const classGroup = await service.baseService.repositories.classGroups.findById(result.classGroupId);
  const academicYear = await service.baseService.repositories.academicYears.findById(period.academicYearId);

  if (result.sectionResults.length === 0) {
    // Seeded/published shells with no computed subjects — nothing useful to render yet.
    return null;
  }

  const locale = input.locale ?? "fr-FR";
  const classSubjectIds = collectClassSubjectIds(result.sectionResults);
  const classSubjects = classSubjectIds.length > 0
    ? await service.baseService.repositories.classSubjects.findByIds(classSubjectIds)
    : [];
  const subjectIds = [...new Set(classSubjects.map(entry => entry.subjectId))];
  const subjects = subjectIds.length > 0
    ? await service.baseService.repositories.subjects.findByIds(subjectIds)
    : [];
  const subjectNameById = new Map(subjects.map(entry => [entry.id, entry.name]));
  const subjectNameByClassSubjectId = new Map(
    classSubjects.map(entry => [
      entry.id,
      subjectNameById.get(entry.subjectId) ?? entry.id,
    ]),
  );

  const teacherNameByClassSubjectId = new Map<string, string>();
  for (const classSubjectId of classSubjectIds) {
    const assignments = await service.baseService.repositories.teacherAssignments.list({
      classSubjectId,
      kind: TeacherAssignmentKind.Subject,
    });
    const teacherId = assignments[0]?.teacherId;
    if (!teacherId) {
      continue;
    }
    const teacher = await service.baseService.repositories.teachers.findById(teacherId);
    if (teacher) {
      teacherNameByClassSubjectId.set(classSubjectId, teacher.fullName);
    }
  }

  let homeroomTeacherName: string | undefined;
  const homeroomAssignments = await service.baseService.repositories.teacherAssignments.list({
    classGroupId: result.classGroupId,
    kind: TeacherAssignmentKind.Homeroom,
  });
  const homeroomTeacherId = homeroomAssignments[0]?.teacherId;
  if (homeroomTeacherId) {
    const homeroomTeacher = await service.baseService.repositories.teachers.findById(homeroomTeacherId);
    homeroomTeacherName = homeroomTeacher?.fullName;
  }
  else if (classGroup?.homeroomStaffId) {
    const homeroomStaff = await service.baseService.repositories.staffMembers.findById(classGroup.homeroomStaffId);
    homeroomTeacherName = homeroomStaff?.fullName;
  }

  const peerResults = await service.baseService.repositories.results.list({
    classGroupId: result.classGroupId,
    periodId: result.periodId,
  });
  const peerAverages = peerResults
    .map(entry => entry.overallAverage)
    .filter((value): value is number => value !== undefined);
  const classResults = peerAverages.length > 0
    ? {
        classAverage: formatClassAverage(
          peerAverages.reduce((sum, value) => sum + value, 0) / peerAverages.length,
          locale,
        ),
        lowestAverage: formatClassAverage(Math.min(...peerAverages), locale),
        highestAverage: formatClassAverage(Math.max(...peerAverages), locale),
      }
    : undefined;

  const payload = buildReportCardV1Payload({
    result,
    student,
    school,
    periodLabel: period.name,
    classLabel: classGroup?.name,
    schoolYear: academicYear?.name,
    locale,
    subjectNameByClassSubjectId,
    teacherNameByClassSubjectId,
    classResults,
    homeroomTeacherName,
  });

  const client = (input.createClient ?? defaultCreateClient)(input.config, school.id);
  const rendered = await client.render({
    templateKey: "report-card.v1",
    format: "pdf",
    locale: "fr",
    schoolId: school.id,
    payload,
    delivery: "inline",
    // Bump key when replacing stub PDFs so docs idempotency cache does not return the empty stub.
    idempotencyKey: stubPdfs.length > 0
      ? `${school.id}/report-card/${result.id}/v1-gotenberg`
      : `${school.id}/report-card/${result.id}/v1`,
  });

  if (!rendered.bytesBase64) {
    throw new Error(`Docs render returned no inline bytes for report card ${result.id}`);
  }

  const bytes = Buffer.from(rendered.bytesBase64, "base64");
  const attachmentId = randomUUID();
  const fileName = `bulletin-${result.id}.pdf`;
  const storageKey = buildStorageKey({
    schoolId: school.id,
    purpose: "generated/report-card",
    ownerKind: AttachmentOwnerKind.ReportCard,
    ownerId: result.id,
    attachmentId,
    fileName,
  });

  const put = await service.baseService.fileStorage.putObject({
    key: storageKey,
    body: bytes,
    contentType: "application/pdf",
    metadata: {
      reportCardResultId: result.id,
      sha256: rendered.sha256,
      renderId: rendered.renderId,
    },
  });

  const uploadedById = service.baseService.actor.kind === "staff"
    ? service.baseService.actor.staffMemberId
    : undefined;
  await service.baseService.entities.attachments.save(new Attachment({
    id: attachmentId,
    schoolId: school.id,
    ownerKind: AttachmentOwnerKind.ReportCard,
    ownerId: result.id,
    fileName,
    storageKey,
    status: AttachmentStatus.Ready,
    checksum: rendered.sha256,
    mimeType: "application/pdf",
    sizeBytes: put.sizeBytes,
    ...(uploadedById ? { uploadedById } : {}),
  }), { moduleChecked: true });

  return { attachmentId, storageKey };
}
