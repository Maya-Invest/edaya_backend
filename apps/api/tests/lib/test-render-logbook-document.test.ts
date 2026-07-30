import { Buffer } from "node:buffer";
import {
  AcademicPeriod,
  AcademicYear,
  Assessment,
  AssessmentKind,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectMatterStatus,
  ClassSubjectProgress,
  LessonSession,
  OccurrenceStatus,
  School,
  Subject,
  SubjectMatter,
} from "@edaya/core";
import { ActorAssuranceLevel, createStaffActorMetadata, Permission } from "@edaya/authorization";
import { describe, expect, mock, test } from "bun:test";
import { renderClassLogbookDocument } from "@/lib/documents/render-logbook-document";

function createLogbookTestStaffActor() {
  return createStaffActorMetadata({
    schoolId: "school-1",
    subjectId: "auth-staff",
    requestId: "req-1",
    authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
    assuranceLevel: ActorAssuranceLevel.Standard,
    staffMemberId: "staff-1",
    effectiveGrants: {
      permissions: new Set([Permission.CLASS_LOGBOOK_READ]),
      scopeGrants: [],
      scopeIdsByPermission: {},
      isElevated: false,
    },
  });
}

describe("renderClassLogbookDocument", () => {
  const school = new School({
    id: "sch-1",
    name: "Collège Edaya",
    timeZone: "UTC",
    city: "Abidjan",
  });
  const year = new AcademicYear({
    id: "ay-1",
    schoolId: school.id,
    name: "2025-2026",
    startDate: new Date("2025-09-01T00:00:00.000Z"),
    endDate: new Date("2026-06-30T00:00:00.000Z"),
  });
  const period = new AcademicPeriod({
    id: "per-1",
    schoolId: school.id,
    academicYearId: year.id,
    name: "1er Trimestre",
    startDate: new Date("2025-09-01T00:00:00.000Z"),
    endDate: new Date("2025-12-31T00:00:00.000Z"),
  });
  const classGroup = new ClassGroup({
    id: "cg-1",
    schoolId: school.id,
    academicYearId: year.id,
    gradeLevelId: "gl-1",
    name: "6ème A",
  });
  const subject = new Subject({
    id: "sub-math",
    schoolId: school.id,
    name: "Mathématiques",
  });
  const classSubject = new ClassSubject({
    id: "cs-math",
    classGroupId: classGroup.id,
    subjectId: subject.id,
  });
  const matter = new SubjectMatter({
    id: "sm-1",
    subjectId: subject.id,
    name: "Nombres relatifs",
    sequenceOrder: 1,
  });
  const classSubjectMatter = new ClassSubjectMatter({
    id: "csm-1",
    classSubjectId: classSubject.id,
    subjectMatterId: matter.id,
    status: ClassSubjectMatterStatus.InProgress,
    completedPercentage: 25,
  });
  const session = new LessonSession({
    id: "ls-1",
    schoolId: school.id,
    classGroupId: classGroup.id,
    classSubjectId: classSubject.id,
    startsAt: new Date("2025-09-16T08:00:00.000Z"),
    endsAt: new Date("2025-09-16T09:00:00.000Z"),
    displayLabel: "Math",
    sessionNote: "Introduction aux relatifs",
    status: OccurrenceStatus.Completed,
  });
  const progress = new ClassSubjectProgress({
    id: "prog-1",
    classSubjectMatterId: classSubjectMatter.id,
    lessonSessionId: session.id,
    completedPercentage: 25,
  });
  const homework = new Assessment({
    id: "as-1",
    classGroupId: classGroup.id,
    classSubjectId: classSubject.id,
    periodId: period.id,
    title: "Exercices 1 à 5",
    kind: AssessmentKind.Homework,
    maxScore: 20,
    lessonSessionId: session.id,
    dueAt: new Date("2025-09-17T00:00:00.000Z"),
  });

  function serviceStub(overrides?: {
    sessions?: LessonSession[];
    progress?: ClassSubjectProgress[];
    assessments?: Assessment[];
  }) {
    return {
      baseService: {
        actor: createLogbookTestStaffActor(),
        repositories: {
          classGroups: { findById: async () => classGroup },
          schools: { findById: async () => school },
          academicPeriods: { findById: async () => period },
          academicYears: { findById: async () => year },
          classSubjects: { list: async () => [classSubject] },
          lessonSessions: { list: async () => overrides?.sessions ?? [session] },
          classSubjectProgress: { list: async () => overrides?.progress ?? [progress] },
          classSubjectMatters: { list: async () => [classSubjectMatter] },
          subjects: { list: async () => [subject] },
          subjectMatters: { list: async () => [matter] },
          teacherAssignments: { list: async () => [] },
          staffAssignments: { list: async () => [] },
          teachers: { list: async () => [] },
          staffMembers: { list: async () => [] },
          assessments: { list: async () => overrides?.assessments ?? [homework] },
        },
        fileStorage: {
          putObject: mock(async () => ({ sizeBytes: 24 })),
          createPresignedDownload: mock(async () => ({
            downloadUrl: "https://cdn.example/logbook.pdf",
            expiresAt: new Date("2026-07-23T12:00:00.000Z"),
          })),
        },
      },
    } as never;
  }

  test("renders inline PDF, stores object, and returns download URL", async () => {
    const service = serviceStub();
    const render = mock(async () => ({
      renderId: "render-1",
      sha256: "abc",
      bytesBase64: Buffer.from("%PDF-logbook").toString("base64"),
    }));

    const outcome = await renderClassLogbookDocument(service, {
      classGroupId: classGroup.id,
      academicPeriodId: period.id,
      config: {
        docsUrl: "http://docs.local",
        jwtSecret: "secret",
      },
      createClient: () => ({ render } as never),
    });

    expect(outcome.downloadUrl).toBe("https://cdn.example/logbook.pdf");
    expect(outcome.fileName).toContain("cahier-de-texte");
    expect(outcome.subjectCount).toBe(1);
    expect(outcome.sessionCount).toBe(1);
    expect(render).toHaveBeenCalledTimes(1);
    const [renderArg] = render.mock.calls[0] as unknown as [{
      templateKey: string;
      payload: { subjects: unknown[] };
    }];
    expect(renderArg.templateKey).toBe("logbook.v1");
    expect(renderArg.payload.subjects).toHaveLength(1);
  });

  test("rejects empty logbook with LOGBOOK_EMPTY", async () => {
    const emptySession = session.copyWith({ sessionNote: undefined });

    await expect(renderClassLogbookDocument(serviceStub({
      sessions: [emptySession],
      progress: [],
      assessments: [],
    }), {
      classGroupId: classGroup.id,
      academicPeriodId: period.id,
      config: { docsUrl: "http://docs.local", jwtSecret: "secret" },
      createClient: () => ({ render: mock(async () => ({})) } as never),
    })).rejects.toMatchObject({ code: "LOGBOOK_EMPTY" });
  });
});
