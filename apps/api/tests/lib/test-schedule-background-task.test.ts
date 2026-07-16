import { describe, expect, mock, spyOn, test } from "bun:test";
import * as buildRuntimeModule from "@/runtime/worker/build-runtime";
import { scheduleBackgroundTask } from "@/lib/school-api/schedule-background-task";
import { createTestStaffActor } from "../support/staff-actor-fixture";

function createScheduleContext(options: {
  runtime?: "local" | "worker";
  taskError?: Error;
}) {
  const loggerErrors: unknown[] = [];
  const waitUntilTasks: Array<Promise<unknown>> = [];
  const dispatchPublishedAnnouncementNotifications = mock(async (_announcementId: string) => {
    if (options.taskError) {
      throw options.taskError;
    }
  });
  const backgroundService = {
    communicationsWorkflow: {
      dispatchPublishedAnnouncementNotifications,
    },
  };

  const context = {
    env: { RUNTIME: options.runtime ?? "local" },
    executionCtx: {
      waitUntil: (promise: Promise<unknown>) => {
        waitUntilTasks.push(promise);
      },
    },
    get(key: string) {
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
  } as never;

  return { context, backgroundService, dispatchPublishedAnnouncementNotifications, loggerErrors, waitUntilTasks };
}

describe("scheduleBackgroundTask", () => {
  test("runs the task immediately on local runtime", async () => {
    const actor = createTestStaffActor();
    const { context, dispatchPublishedAnnouncementNotifications } = createScheduleContext({});
    const task = mock(async () => {
      await dispatchPublishedAnnouncementNotifications("announcement-1");
    });

    scheduleBackgroundTask(context, actor, task);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(task).toHaveBeenCalled();
    expect(dispatchPublishedAnnouncementNotifications).toHaveBeenCalledWith(
      "announcement-1",
    );
  });

  test("logs failures without throwing on local runtime", async () => {
    const actor = createTestStaffActor();
    const failure = new Error("background failed");
    const { context, loggerErrors } = createScheduleContext({ taskError: failure });

    scheduleBackgroundTask(context, actor, async (service) => {
      await service.communicationsWorkflow.dispatchPublishedAnnouncementNotifications("announcement-1");
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(loggerErrors.length).toBeGreaterThan(0);
  });

  test("uses waitUntil on worker runtime", async () => {
    const actor = createTestStaffActor();
    const { context, waitUntilTasks } = createScheduleContext({ runtime: "worker" });
    const task = mock(async () => undefined);

    scheduleBackgroundTask(context, actor, task);

    expect(waitUntilTasks).toHaveLength(1);
  });

  test("runs worker background tasks through a dedicated runtime", async () => {
    const actor = createTestStaffActor();
    const close = mock(async () => undefined);
    const task = mock(async () => undefined);
    spyOn(buildRuntimeModule, "buildWorkerApiRuntime").mockResolvedValue({
      getSchoolApplication: async () => ({
        forActor: () => ({}),
      }),
      close,
    } as never);

    const waitUntilTasks: Array<Promise<unknown>> = [];
    const context = {
      env: { RUNTIME: "worker" },
      executionCtx: {
        waitUntil: (promise: Promise<unknown>) => {
          waitUntilTasks.push(promise);
        },
      },
      get: () => undefined,
      var: {
        logger: {
          error: () => undefined,
        },
      },
    } as never;

    scheduleBackgroundTask(context, actor, task);
    await waitUntilTasks[0];

    expect(task).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
