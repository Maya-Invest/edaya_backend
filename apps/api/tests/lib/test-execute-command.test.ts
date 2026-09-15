import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { executeSchoolCommand } from "@/lib/school-api/execute-command";
import * as scheduleBackgroundTaskModule from "@/lib/school-api/schedule-background-task";
import { createTestStaffActor } from "../support/staff-actor-fixture";

afterEach(() => {
  mock.restore();
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
    const publishAcademicYear = mock(async () => ({ id: "year-1" }));
    const { context } = createCommandContext({});
    const service = {
      commands: { publishAcademicYear },
    } as never;

    await expect(executeSchoolCommand(
      context,
      service,
      "publishAcademicYear",
      { academicYearId: "year-1" },
    )).resolves.toEqual({ id: "year-1" });
  });

  test("does not use waitUntil issuance for publishReportCardResult", async () => {
    const scheduleBackgroundTask = spyOn(
      scheduleBackgroundTaskModule,
      "scheduleBackgroundTask",
    ).mockImplementation(() => undefined);
    const publishReportCardResult = mock(async () => ({ id: "rc-1" }));
    const actor = createTestStaffActor();
    const { context } = createCommandContext({ actor });
    const service = {
      commands: { publishReportCardResult },
    } as never;

    await expect(executeSchoolCommand(
      context,
      service,
      "publishReportCardResult",
      { resultId: "rc-1" },
    )).resolves.toEqual({ id: "rc-1" });

    expect(scheduleBackgroundTask).not.toHaveBeenCalled();
    expect(publishReportCardResult).toHaveBeenCalled();
  });

  test("renderClassLogbook requests issuance through the command registry", async () => {
    const renderClassLogbook = mock(async () => ({ id: "iss-1", status: "requested" }));
    const { context } = createCommandContext({});
    const service = { commands: { renderClassLogbook } } as never;

    await expect(executeSchoolCommand(
      context,
      service,
      "renderClassLogbook",
      { classGroupId: "cg-1" },
    )).resolves.toEqual({ id: "iss-1", status: "requested" });
  });
});
