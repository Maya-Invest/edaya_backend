import { Permission } from '@edaya/core';
import { randomUUID } from "node:crypto";
import { AssessmentKind, BusinessRuleViolationError, type DocumentRendererPort, OccurrenceStatus, TeacherAssignmentKind, TeacherAssignmentStatus } from "@edaya/core";

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

function formatPersonName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
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
 * Does not register a durable Attachment — staff on-demand archive only.
 */
export async function renderClassLogbookDocument(
  service: SchoolService,
  input: RenderClassLogbookDocumentInput,
): Promise<RenderClassLogbookDocumentResult> {
  await service.baseService.access.assertSchool([Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.GRADE_INPUT]);

  const classGroup = await service.baseService.repositories.classGroups.findById(input.classGroupId);
  if (!classGroup) {
    throw new BusinessRuleViolationError(
      "CLASS_GROUP_NOT_FOUND",
      `Unknown class group: ${input.classGroupId}`,
    );
  }

  const school = await service.baseService.repositories.schools.findById(classGroup.schoolId);
  if (!school) {
    throw new BusinessRuleViolationError(
      "SCHOOL_NOT_FOUND",
      `Unknown school: ${classGroup.schoolId}`,
    );
  }

  const period = input.academicPeriodId
    ? await service.baseService.repositories.academicPeriods.findById(input.academicPeriodId)
    : undefined;
  if (input.academicPeriodId && !period) {
    throw new BusinessRuleViolationError(
      "ACADEMIC_PERIOD_NOT_FOUND",
      `Unknown academic period: ${input.academicPeriodId}`,
    );
  }

  const academicYear = period
    ? await service.baseService.repositories.academicYears.findById(period.academicYearId)
    : undefined;

  const timeZone = school.timeZone || "Africa/Abidjan";
  const locale = input.locale ?? "fr-FR";
  const catalogLang = catalogLangFromLocale(locale);

  const [classSubjects, lessonSessions] = await Promise.all([
    service.baseService.repositories.classSubjects.list({ classGroupId: classGroup.id }),
    service.baseService.repositories.lessonSessions.list({ classGroupId: classGroup.id }),
  ]);

  const scopedClassSubjects = input.classSubjectId
    ? classSubjects.filter(entry => entry.id === input.classSubjectId)
    : classSubjects;
  if (input.classSubjectId && scopedClassSubjects.length === 0) {
    throw new BusinessRuleViolationError(
      "CLASS_SUBJECT_NOT_FOUND",
      `Unknown class subject: ${input.classSubjectId}`,
    );
  }

  const classSubjectIds = new Set(scopedClassSubjects.map(entry => entry.id));
  const sessionsInScope = lessonSessions.filter((session) => {
    if (!classSubjectIds.has(session.classSubjectId)) {
      return false;
    }
    if (!period) {
      return true;
    }
    return period.contains(session.startsAt);
  });

  const sessionIds = sessionsInScope.map(session => session.id);
  const subjectIds = [...new Set(scopedClassSubjects.map(entry => entry.subjectId))];

  const [
    progressRecords,
    classSubjectMatters,
    subjects,
    teacherAssignments,
    staffAssignments,
    homeworkAssessments,
  ] = await Promise.all([
    sessionIds.length > 0
      ? service.baseService.repositories.classSubjectProgress.list({
          lessonSessionId: { $in: sessionIds },
        })
      : Promise.resolve([]),
    classSubjectIds.size > 0
      ? service.baseService.repositories.classSubjectMatters.list({
          classSubjectId: { $in: [...classSubjectIds] },
        })
      : Promise.resolve([]),
    subjectIds.length > 0
      ? service.baseService.repositories.subjects.list({ id: { $in: subjectIds } })
      : Promise.resolve([]),
    classSubjectIds.size > 0
      ? service.baseService.repositories.teacherAssignments.list({
          classSubjectId: { $in: [...classSubjectIds] },
          kind: TeacherAssignmentKind.Subject,
          status: TeacherAssignmentStatus.Active,
        })
      : Promise.resolve([]),
    classSubjectIds.size > 0
      ? service.baseService.repositories.staffAssignments.list({
          classSubjectId: { $in: [...classSubjectIds] },
        })
      : Promise.resolve([]),
    sessionIds.length > 0
      ? service.baseService.repositories.assessments.list({
          classGroupId: classGroup.id,
          kind: AssessmentKind.Homework,
          lessonSessionId: { $in: sessionIds },
        })
      : Promise.resolve([]),
  ]);

  const matterIds = [...new Set(classSubjectMatters.map(entry => entry.subjectMatterId))];
  const subjectMatters = matterIds.length > 0
    ? await service.baseService.repositories.subjectMatters.list({ id: { $in: matterIds } })
    : [];

  const teacherIds = [...new Set(teacherAssignments.map(entry => entry.teacherId))];
  const staffIds = [...new Set(staffAssignments.map(entry => entry.staffId))];
  const [teachers, staffMembers] = await Promise.all([
    teacherIds.length > 0
      ? service.baseService.repositories.teachers.list({ id: { $in: teacherIds } })
      : Promise.resolve([]),
    staffIds.length > 0
      ? service.baseService.repositories.staffMembers.list({ id: { $in: staffIds } })
      : Promise.resolve([]),
  ]);

  const subjectNameById = new Map(
    subjects.map(entry => [
      entry.id,
      catalogSubjectName(entry.name, catalogLang, entry.code),
    ]),
  );
  const teacherById = new Map(teachers.map(entry => [entry.id, entry]));
  const staffById = new Map(staffMembers.map(entry => [entry.id, entry]));
  const teacherNameByClassSubjectId = new Map<string, string>();
  for (const classSubject of scopedClassSubjects) {
    const teacherAssignment = teacherAssignments.find(
      entry => entry.classSubjectId === classSubject.id,
    );
    if (teacherAssignment) {
      const teacher = teacherById.get(teacherAssignment.teacherId);
      if (teacher) {
        teacherNameByClassSubjectId.set(
          classSubject.id,
          formatPersonName(teacher.firstName, teacher.lastName),
        );
        continue;
      }
    }
    const staffAssignment = staffAssignments.find(
      entry => entry.classSubjectId === classSubject.id,
    );
    if (staffAssignment) {
      const staff = staffById.get(staffAssignment.staffId);
      if (staff) {
        teacherNameByClassSubjectId.set(
          classSubject.id,
          formatPersonName(staff.firstName, staff.lastName),
        );
      }
    }
  }

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
