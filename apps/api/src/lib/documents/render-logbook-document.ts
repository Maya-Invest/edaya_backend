import { randomUUID } from "node:crypto";
import { BusinessRuleViolationError, type DocumentRendererPort, OccurrenceStatus } from "@edaya/core";

import { buildLogbookV1Payload, catalogClassName, catalogLangFromLocale, catalogMatter, catalogPeriodLabel, catalogSubjectName, sanitizeFileName } from "@edaya/service";
import type { SchoolService } from "@edaya/service";

export interface RenderClassLogbookDocumentInput {
  classGroupId: string;
  academicPeriodId?: string;
  classSubjectId?: string;
  locale?: string;
  renderer: DocumentRendererPort;
}

export interface RenderClassLogbookDocumentResult {
  fileName: string;
  contentType: "application/pdf";
  downloadUrl: string;
  expiresAt: string;
  subjectCount: number;
  sessionCount: number;
}

function formatIsoDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/**
 * Assembles class logbook content, renders `logbook.v1` in-process,
 * stores the PDF in school object storage, and returns a short-lived download URL.
 * Produces an on-demand export without registering a durable Attachment.
 */
export async function renderClassLogbookDocument(
  service: SchoolService,
  input: RenderClassLogbookDocumentInput,
): Promise<RenderClassLogbookDocumentResult> {
  const { access } = service.baseService;
  const { classGroup, school, period, academicYear, classSubjects: scopedClassSubjects, lessonSessions: sessionsInScope, progressRecords, classSubjectMatters, subjects, subjectMatters, homeworkAssessments, teacherNameByClassSubjectId } = await access.logbooks.documentContext(input);
  const timeZone = school.timeZone;
  const locale = input.locale ?? "fr-FR";
  const catalogLang = catalogLangFromLocale(locale);
  const subjectNameById = new Map(subjects.map(entry => [entry.id, catalogSubjectName(entry.name, catalogLang, entry.code)]));
  const assertExport = () => access.logbooks.assertDocumentExport({ classGroupId: classGroup.id, classSubjectIds: scopedClassSubjects.map(subject => subject.id), lessonSessionIds: sessionsInScope.map(session => session.id) });

  const chapterNameByMatterLinkId = new Map(
    classSubjectMatters.map((link) => {
      const matter = subjectMatters.find(entry => entry.id === link.subjectMatterId);
      return [link.id, catalogMatter(matter?.name ?? "", catalogLang)] as const;
    }).filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );

  let payload;
  try {
    payload = buildLogbookV1Payload({
      schoolName: school.name,
      classLabel: catalogClassName(classGroup.name, catalogLang),
      schoolCity: school.city,
      schoolYear: academicYear?.name,
      periodLabel: period ? catalogPeriodLabel(period.name, catalogLang) : undefined,
      dateFrom: period ? formatIsoDate(period.startDate, timeZone) : undefined,
      dateTo: period ? formatIsoDate(period.endDate, timeZone) : undefined,
      locale,
      timeZone,
      subjects: scopedClassSubjects.map(classSubject => ({
        classSubjectId: classSubject.id,
        name: subjectNameById.get(classSubject.subjectId) ?? classSubject.id,
        teacherName: teacherNameByClassSubjectId.get(classSubject.id),
      })),
      sessions: sessionsInScope.map(session => ({
        id: session.id,
        classSubjectId: session.classSubjectId,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        displayLabel: session.displayLabel,
        sessionNote: session.sessionNote,
        status: session.status ?? OccurrenceStatus.Pending,
      })),
      progress: progressRecords.map(progress => ({
        lessonSessionId: progress.lessonSessionId,
        classSubjectMatterId: progress.classSubjectMatterId,
        completedPercentage: progress.completedPercentage,
        notes: progress.notes,
      })),
      chapters: [...chapterNameByMatterLinkId.entries()].map(([classSubjectMatterId, name]) => ({
        classSubjectMatterId,
        name,
      })),
      homework: homeworkAssessments.flatMap((assessment) => {
        if (!assessment.lessonSessionId) {
          return [];
        }
        const text = (assessment.description ?? assessment.title).trim();
        if (!text) {
          return [];
        }
        return [{ lessonSessionId: assessment.lessonSessionId, text }];
      }),
    });
  }
  catch (error) {
    if (error instanceof Error && /no logbook content/i.test(error.message)) {
      throw new BusinessRuleViolationError(
        "LOGBOOK_EMPTY",
        `No logbook content for class ${classGroup.name}`,
      );
    }
    throw error;
  }

  const rendered = await input.renderer.render({
    templateKey: "logbook.v1",
    locale: locale.startsWith("en") ? "en" : "fr",
    payload,
  });
  const bytes = rendered.bytes;
  const fileName = sanitizeFileName(
    `${locale.toLowerCase().startsWith("en") ? "class-logbook" : "cahier-de-texte"}-${classGroup.name.replace(/\s+/g, "-").toLowerCase()}.pdf`,
  );
  const storageKey = [
    school.id,
    "generated/logbook",
    classGroup.id,
    randomUUID(),
    fileName,
  ].join("/");

  await assertExport();
  await service.baseService.fileStorage.putObject({
    key: storageKey,
    body: bytes,
    contentType: "application/pdf",
    metadata: {
      classGroupId: classGroup.id,
      ...(period ? { academicPeriodId: period.id } : {}),
      sha256: rendered.sha256,
      renderId: rendered.renderId,
    },
  });

  await assertExport();
  const presigned = await service.baseService.fileStorage.createPresignedDownload(
    storageKey,
    { fileName, expiresInSeconds: 15 * 60 },
  );

  return {
    fileName,
    contentType: "application/pdf",
    downloadUrl: presigned.downloadUrl,
    expiresAt: presigned.expiresAt.toISOString(),
    subjectCount: payload.summary?.subjectCount ?? payload.subjects.length,
    sessionCount: payload.summary?.sessionCount
      ?? payload.subjects.reduce((sum, subject) => sum + subject.entries.length, 0),
  };
}
