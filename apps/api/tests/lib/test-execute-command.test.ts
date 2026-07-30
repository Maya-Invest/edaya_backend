import { describe, expect, mock, test } from "bun:test";
import { executeSchoolCommand } from "@/lib/school-api/execute-command";
import { createTestStaffActor } from "../support/staff-actor-fixture";

function createCommandContext(options: {
  actor?: ReturnType<typeof createTestStaffActor> | null;
  schedule?: (task: () => Promise<void>) => void;
}) {
  const backgroundTasks: Array<() => Promise<void>> = [];
  const loggerErrors: unknown[] = [];

  return {
    context: {
      env: { RUNTIME: "local" },
      get(key: string) {
        if (key === "actor") {
          return options.actor ?? null;
        }
        if (key === "schoolApp") {
          return {
            forActor: () => ({
              communicationsWorkflow: {
                dispatchPublishedAnnouncementNotifications: mock(async () => undefined),
              },
            }),
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
});
