import type { AppBindings } from "@/http/types";
import { ActorAssuranceLevel } from "@edaya/authorization";
import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import indexRouter from "@/app-router";

describe("generated core query endpoints", () => {
  const mockActor = {
    kind: "staff" as const,
    accountKind: "human" as const,
    actorId: "staff-1",
    subjectId: "admin-user",
    schoolId: "school-1",
    staffMemberId: "staff-1",
    requestId: "request-id",
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Strong,
  };

  const setupTestApp = (service: Record<string, unknown>) => {
    const app = new Hono<AppBindings>();

    app.use(async (c, next) => {
      c.set("actor", mockActor);
      c.set("schoolApp", {
        forActor: () => service,
      } as any);
      await next();
    });

    app.route("/", indexRouter);
    return app;
  };

  const mockReadService = (overrides: Record<string, unknown>) => ({
    list: mock().mockResolvedValue([]),
    findOne: mock().mockResolvedValue(undefined),
    count: mock().mockResolvedValue(0),
    findById: mock().mockResolvedValue(undefined),
    findByIds: mock().mockResolvedValue([]),
    save: mock().mockResolvedValue(undefined),
    batchSave: mock().mockResolvedValue([]),
    delete: mock().mockResolvedValue(undefined),
    batchDelete: mock().mockResolvedValue(undefined),
    ...overrides,
  });

  for (const query of [
    { path: "get-teacher-subject-period-summary", method: "getTeacherSubjectPeriodSummary", input: { classSubjectId: "subject-1", periodId: "period-1" }, output: { classSubjectId: "subject-1", classGroupId: "class-1", periodId: "period-1", calculationReady: true, students: [] } },
    { path: "get-activity-roster", method: "getActivityRoster", input: { activityId: "club-1" }, output: { students: [], eligibleStudentIds: [], classes: [] } },
    { path: "get-assessment-editor-context", method: "getAssessmentEditorContext", input: { classGroupId: "class-1", periodId: "period-1" }, output: { assessmentsRaw: [], classSubjectsRaw: [], subjectsRaw: [], classSize: 0, markResults: [] } },
  ]) {
    it(`dispatches bounded ${query.path} context and rejects missing targets`, async () => {
      const handler = mock().mockResolvedValue(query.output);
      const app = setupTestApp({ baseService: {}, [query.method]: handler });
      const request = (body: unknown) => app.request(`/core/queries/${query.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const response = await request(query.input);
      expect(response.status).toBe(200);
      expect(await response.json() as unknown).toEqual(query.output);
      expect(handler).toHaveBeenCalledWith(query.input);
      expect((await request({})).status).toBe(422);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  }

  it("counts generated core entities", async () => {
    const mockCount = mock().mockResolvedValue(2);
    const app = setupTestApp({
      baseService: {
        entities: {
          students: mockReadService({ count: mockCount }),
        },
      },
    });

    const res = await app.request("/core/entities/students/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "550e8400-e29b-41d4-a716-446655440000",
        $limit: 10,
      }),
    });

    const body = await res.json() as { count: number };
    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(mockCount).toHaveBeenCalledWith({
      schoolId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("finds one generated core entity", async () => {
    const student = {
      id: "student-1",
      schoolId: "school-1",
      firstName: "EDaya",
      lastName: "Diallo",
    };
    const mockFindOne = mock().mockResolvedValue(student);
    const app = setupTestApp({
      baseService: {
        entities: {
          students: mockReadService({ findOne: mockFindOne }),
        },
      },
    });

    const res = await app.request("/core/entities/students/one", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(expect.objectContaining(student));
    expect(mockFindOne).toHaveBeenCalledWith({});
  });

  it("executes aggregate core query routes", async () => {
    const mockGetOverdueFeeCount = mock().mockResolvedValue(3);
    const app = setupTestApp({
      baseService: {},
      getOverdueFeeCount: mockGetOverdueFeeCount,
    });

    const res = await app.request("/core/queries/get-overdue-fee-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: "school-1" }),
    });

    const body = await res.json() as { count: number };
    expect(res.status).toBe(200);
    expect(body.count).toBe(3);
    expect(mockGetOverdueFeeCount).toHaveBeenCalledWith("school-1");
  });

  it("executes get-school-overview query route", async () => {
    const mockGetSchoolOverview = mock().mockResolvedValue({
      schoolId: "school-1",
      academicYearId: "year-1",
      academicPeriodId: "period-1",
      referenceDate: "2026-06-14",
      kpis: {
        studentCount: 42,
        staffCount: 8,
        overdueFeeCount: 0,
        overdueFeeAmount: 0,
        publishedReportCardCount: 10,
        unpublishedReportCardCount: 32,
        attendanceRateToday: 96.5,
        absencesToday: 1,
        openIncidentCount: 0,
        highSeverityIncidentCount: 0,
        pendingJustificationCount: 0,
        incompleteGradingClassCount: 0,
      },
      actionItems: [],
      upcoming: [],
    });
    const app = setupTestApp({
      baseService: {},
      getSchoolOverview: mockGetSchoolOverview,
    });

    const res = await app.request("/core/queries/get-school-overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "school-1",
        academicYearId: "year-1",
        academicPeriodId: "period-1",
        referenceDate: "2026-06-14",
      }),
    });

    const body = await res.json() as { kpis: { studentCount: number } };
    expect(res.status).toBe(200);
    expect(body.kpis.studentCount).toBe(42);
    expect(mockGetSchoolOverview).toHaveBeenCalledWith({
      schoolId: "school-1",
      academicYearId: "year-1",
      academicPeriodId: "period-1",
      referenceDate: new Date("2026-06-14T00:00:00.000Z"),
    });
  });

  it("accepts a year-only dashboard query but rejects an explicitly invalid period", async () => {
    const getSchoolOverview = mock().mockResolvedValue({ academicPeriodId: null });
    const app = setupTestApp({ baseService: {}, getSchoolOverview });
    const request = (academicPeriodId?: string) => app.request("/core/queries/get-school-overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: "school-1", academicYearId: "year-1", academicPeriodId }),
    });
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json() as { academicPeriodId: null }).toEqual({ academicPeriodId: null });
    expect(getSchoolOverview).toHaveBeenCalledWith({ schoolId: "school-1", academicYearId: "year-1", academicPeriodId: undefined, referenceDate: undefined });
    expect((await request("")).status).toBe(422);
    expect(getSchoolOverview).toHaveBeenCalledTimes(1);
  });

  it("executes get-class-group-timetable query route", async () => {
    const mockGetClassGroupTimetable = mock().mockResolvedValue({
      classGroupId: "cg-1",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      events: [],
    });
    const app = setupTestApp({
      baseService: {},
      getClassGroupTimetable: mockGetClassGroupTimetable,
    });

    const res = await app.request("/core/queries/get-class-group-timetable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classGroupId: "cg-1",
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      }),
    });

    const body = await res.json() as { classGroupId: string; events: unknown[] };
    expect(res.status).toBe(200);
    expect(body.classGroupId).toBe("cg-1");
    expect(body.events).toEqual([]);
    expect(mockGetClassGroupTimetable).toHaveBeenCalledWith({
      classGroupId: "cg-1",
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-31T00:00:00.000Z"),
    });
  });

  it("executes get-teacher-timetable query route", async () => {
    const mockGetTeacherTimetable = mock().mockResolvedValue({
      teacherId: "teacher-1",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      events: [],
    });
    const app = setupTestApp({
      baseService: {},
      getTeacherTimetable: mockGetTeacherTimetable,
    });

    const res = await app.request("/core/queries/get-teacher-timetable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId: "teacher-1",
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      }),
    });

    const body = await res.json() as { teacherId: string; events: unknown[] };
    expect(res.status).toBe(200);
    expect(body.teacherId).toBe("teacher-1");
    expect(body.events).toEqual([]);
    expect(mockGetTeacherTimetable).toHaveBeenCalledWith({
      teacherId: "teacher-1",
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-31T00:00:00.000Z"),
    });
  });
});
