import { afterEach, describe, expect, mock, test } from "bun:test";
import { executeSchoolCommand } from "@/lib/school-api/execute-command";
import { createTestStaffActor } from "../support/staff-actor-fixture";

const renderReportCardDocument = mock(async () => ({
  attachmentId: "att-1",
  storageKey: "sch-1/generated/report-card/report_card/rc-1/att-1/bulletin.pdf",
}));

mock.module("@/lib/documents/render-report-card-document", () => ({
  renderReportCardDocument,
}));

afterEach(() => {
  renderReportCardDocument.mockClear();
});

function createCommandContext(options: {
  actor?: ReturnType<typeof createTestStaffActor> | null;
  env?: Record<string, unknown>;
}) {
  const backgroundTasks: Array<() => Promise<void>> = [];
  const loggerErrors: unknown[] = [];
  const backgroundService = {
    communicationsWorkflow: {
      dispatchPublishedAnnouncementNotifications: mock(async () => undefined),
    },
  };

  return {
    context: {
      env: { RUNTIME: "local", ...options.env },
      get(key: string) {
        if (key === "actor") {
          return options.actor ?? null;
        }
        if (key === "schoolApp") {
          return {
            forActor: () => backgroundService,
          };
        }
        return undefined;
      },
      var: {
        logger: {
          error: (payload: unknown) => {
            loggerErrors.push(payload);
          },
        },
      },
    } as never,
    backgroundTasks,
    loggerErrors,
    backgroundService,
  };
}

describe("executeSchoolCommand", () => {
  test("defers publishAnnouncement notifications to a background task", async () => {
    const publishAnnouncement = mock(async () => ({ id: "announcement-1" }));
    const actor = createTestStaffActor();
    const { context } = createCommandContext({ actor });
    const service = {
      communicationsWorkflow: {
        publishAnnouncement,
      },
      commands: {},
    } as never;

    const result = await executeSchoolCommand(
      context,
      service,
      "publishAnnouncement",
      { announcementId: "announcement-1" },
    );

    expect(result).toEqual({ id: "announcement-1" });
    expect(publishAnnouncement).toHaveBeenCalledWith(
      { announcementId: "announcement-1" },
      { deferNotifications: true },
    );
  });

  test("dispatches non-announcement commands through the school command registry", async () => {
    const activateAcademicYear = mock(async () => ({ id: "year-1" }));
    const { context } = createCommandContext({});
    const service = {
      commands: { activateAcademicYear },
    } as never;

    await expect(executeSchoolCommand(
      context,
      service,
      "activateAcademicYear",
      { academicYearId: "year-1" },
    )).resolves.toEqual({ id: "year-1" });
  });

  test("schedules docs render after publishReportCardResult when enabled", async () => {
    const publishReportCardResult = mock(async () => ({ id: "rc-1" }));
    const actor = createTestStaffActor();
    const { context } = createCommandContext({
      actor,
      env: {
        DOCS_RENDER_ON_PUBLISH: true,
        EDAYA_DOCS_URL: "http://localhost:8787",
        DOCS_JWT_SECRET: "secret",
      },
    });
    const service = {
      commands: { publishReportCardResult },
    } as never;

    await expect(executeSchoolCommand(
      context,
      service,
      "publishReportCardResult",
      { resultId: "rc-1" },
    )).resolves.toEqual({ id: "rc-1" });

    await Bun.sleep(10);
    expect(renderReportCardDocument).toHaveBeenCalledTimes(1);
    const renderArgs = renderReportCardDocument.mock.calls[0] as unknown as [
      unknown,
      { resultId: string; config: { docsUrl: string; jwtSecret: string } },
    ];
    expect(renderArgs[1]).toMatchObject({
      resultId: "rc-1",
      config: {
        docsUrl: "http://localhost:8787",
        jwtSecret: "secret",
      },
    });
  });

  test("does not schedule docs render when DOCS_RENDER_ON_PUBLISH is off", async () => {
    const publishReportCardResult = mock(async () => ({ id: "rc-1" }));
    const actor = createTestStaffActor();
    const { context } = createCommandContext({
      actor,
      env: {
        DOCS_RENDER_ON_PUBLISH: false,
        EDAYA_DOCS_URL: "http://localhost:8787",
        DOCS_JWT_SECRET: "secret",
      },
    });
    const service = {
      commands: { publishReportCardResult },
    } as never;

    await executeSchoolCommand(
      context,
      service,
      "publishReportCardResult",
      { resultId: "rc-1" },
    );

    await Bun.sleep(10);
    expect(renderReportCardDocument).not.toHaveBeenCalled();
  });
});
