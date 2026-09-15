/**
 * @deprecated Logbook PDFs are issued through `requestDocumentIssuance` (`logbook.v1`).
 * This module is retained only as a named adapter for leftover imports.
 */
import type { SchoolService } from "@edaya/service";

export async function renderClassLogbookDocument(
  service: SchoolService,
  input: { classGroupId: string; academicPeriodId?: string; classSubjectId?: string; locale?: string },
) {
  return service.documentsWorkflow.requestDocumentIssuance({
    requestId: `logbook:${input.classGroupId}:${input.academicPeriodId ?? ""}:${input.classSubjectId ?? ""}:${crypto.randomUUID()}`,
    templateKey: "logbook.v1",
    sourceId: input.classGroupId,
    academicPeriodId: input.academicPeriodId,
    classSubjectId: input.classSubjectId,
    locale: input.locale?.startsWith("en") ? "en" : "fr",
  });
}
