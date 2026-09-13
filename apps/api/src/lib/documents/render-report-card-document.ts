import { randomUUID } from "node:crypto";
import { Attachment, AttachmentOwnerKind, AttachmentStatus, BusinessRuleViolationError, ReportCardResultStatus } from "@edaya/core";
import type { AcademicPeriod, DocumentRendererPort, ReportCardResult } from "@edaya/core";
import { buildReportCardV1Payload, buildStorageKey, catalogLangFromLocale, catalogSubjectName, validateAttachmentSave } from "@edaya/service";
import type { SchoolService } from "@edaya/service";

function formatClassAverage(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} / 20`;
}

function assertPublished(result: ReportCardResult, period: AcademicPeriod): void {
  if (result.status !== ReportCardResultStatus.Published || !period.isPublished) {
    throw new BusinessRuleViolationError("REPORT_DOCUMENT_UNPUBLISHED", "Report documents require a published result and academic period");
  }
}

export interface RenderReportCardDocumentInput {
  resultId: string;
  renderer: DocumentRendererPort;
  locale?: string;
}

/**
 * Loads a published report card, renders `report-card.v1` in-process,
 * stores the PDF in school object storage, and registers an attachment.
 */
export async function renderReportCardDocument(
  service: SchoolService,
  input: RenderReportCardDocumentInput,
): Promise<{ attachmentId: string; storageKey: string } | null> {
  return service.baseService.atomicExecution.execute(async () => {
    const { access, repositories } = service.baseService;
    const { result, student, school, period, classGroup, academicYear, subjects, teacherNameByClassSubjectId, homeroomTeacherName, peerResults, attachments: existing } = await access.reportCards.documentContext(input.resultId);
    assertPublished(result, period);
    const authorizeAttachment = async (attachment: Attachment) => {
      const { scope, result: currentResult, period: currentPeriod } = await access.reportCards.assertDocumentAttachment(result.id, attachment);
      assertPublished(currentResult, currentPeriod);
      const previous = await repositories.attachments.forAccess(scope).findById(attachment.id);
      await validateAttachmentSave(attachment, previous, repositories);
      return scope;
    };
    const saveAttachment = async (attachment: Attachment) => repositories.attachments.forAccess(await authorizeAttachment(attachment)).save(attachment);
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
      await saveAttachment(new Attachment({
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
      }));
    }

    if (result.sectionResults.length === 0) {
    // Seeded/published shells with no computed subjects — nothing useful to render yet.
      return null;
    }

    const locale = input.locale ?? "fr-FR";
    const catalogLang = catalogLangFromLocale(locale);
    const subjectNameByClassSubjectId = new Map(subjects.map(({ classSubjectId, subject }) => [classSubjectId, catalogSubjectName(subject.name, catalogLang, subject.code)]));

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
      classLabel: classGroup.name,
      schoolYear: academicYear.name,
      locale,
      subjectNameByClassSubjectId,
      teacherNameByClassSubjectId,
      classResults,
      homeroomTeacherName,
    });

    const rendered = await input.renderer.render({
      templateKey: "report-card.v1",
      locale: locale.toLowerCase().startsWith("en") ? "en" : "fr",
      payload,
    });
    const bytes = rendered.bytes;
    const attachmentId = randomUUID();
    const fileName = locale.toLowerCase().startsWith("en")
      ? `report-card-${result.id}.pdf`
      : `bulletin-${result.id}.pdf`;
    const storageKey = buildStorageKey({
      schoolId: school.id,
      purpose: "generated/report-card",
      ownerKind: AttachmentOwnerKind.ReportCard,
      ownerId: result.id,
      attachmentId,
      fileName,
    });

    const uploadedById = service.baseService.actor.kind === "staff"
      ? service.baseService.actor.staffMemberId
      : undefined;
    const attachment = new Attachment({
      id: attachmentId,
      schoolId: school.id,
      ownerKind: AttachmentOwnerKind.ReportCard,
      ownerId: result.id,
      fileName,
      storageKey,
      status: AttachmentStatus.Ready,
      checksum: rendered.sha256,
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      ...(uploadedById ? { uploadedById } : {}),
    });
    await authorizeAttachment(attachment);
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

    await saveAttachment(new Attachment({ ...attachment.data, sizeBytes: put.sizeBytes }));

    return { attachmentId, storageKey };
  });
}
