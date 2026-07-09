import { describe, expect, mock, test } from "bun:test";
import type { LoggerPort } from "@edaya/core";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ApiRuntime } from "@/runtime/types";
import {
  parseCronJobKeysFilter,
  runCronHeartbeat,
  runCronHeartbeatWithRuntime,
  runScheduledCronWithRuntime,
} from "@/cron/run-scheduled-cron";

describe("parseCronJobKeysFilter", () => {
  test("returns undefined when unset or empty", () => {
    expect(parseCronJobKeysFilter(undefined)).toBeUndefined();
    expect(parseCronJobKeysFilter("")).toBeUndefined();
    expect(parseCronJobKeysFilter(" , ")).toBeUndefined();
  });

  test("parses comma-separated job keys", () => {
    expect(parseCronJobKeysFilter("processDueNotifications")).toEqual(["processDueNotifications"]);
    expect(parseCronJobKeysFilter("processDueNotifications, reconcilePendingDeliveries")).toEqual([
      "processDueNotifications",
      "reconcilePendingDeliveries",
    ]);
  });
});

describe("runCronHeartbeat", () => {
  test("dispatches due schedules for every school and logs the tick summary", async () => {
    const dispatch = mock(async () => undefined);
    const markDispatched = mock(async () => undefined);
    const listDue = mock(async () => [{
      id: "sched-1",
      jobKey: "processDueNotifications" as const,
      cronExpression: "*/5 * * * *",
    }]);
    const application = {
      repositories: {
        cronJobSchedules: { listDue, markDispatched },
        schools: { list: async () => [{ id: "school-1" }, { id: "school-2" }] },
      },
    } as unknown as ApiSchoolApplication;
    const info = mock(() => undefined);
    const logger = { info } as unknown as LoggerPort;
    const asOf = new Date("2026-07-07T12:00:00.000Z");

    const summary = await runCronHeartbeat(application, {
      asOf,
      requestIdPrefix: "test-cron",
      dispatcher: { dispatch },
    }, logger);

    expect(summary.dispatches).toHaveLength(2);
    expect(summary.dispatches[0]?.schoolId).toBe("school-1");
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(markDispatched).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cron.tick",
        dispatchCount: 2,
      }),
      "cron heartbeat tick completed",
    );
  });
});

describe("runCronHeartbeatWithRuntime", () => {
  test("loads the school application from runtime and forwards the dispatcher", async () => {
    const application = {
      repositories: {
        cronJobSchedules: {
          listDue: async () => [],
          markDispatched: async () => undefined,
        },
        schools: { list: async () => [] },
      },
    } as unknown as ApiSchoolApplication;
    const runtime = {
      env: { RUNTIME: "local" },
      getSchoolApplication: mock(async () => application),
    } as unknown as ApiRuntime;

    const summary = await runCronHeartbeatWithRuntime(runtime, {
      asOf: new Date("2026-07-07T12:00:00.000Z"),
      requestIdPrefix: "worker-cron",
      dispatcher: { dispatch: async () => undefined },
    });

    expect(summary.dispatches).toEqual([]);
    expect(runtime.getSchoolApplication).toHaveBeenCalledTimes(1);
  });
});

describe("runScheduledCronWithRuntime", () => {
  test("runs selected cron jobs directly for each school", async () => {
    const application = {
      repositories: {
        schools: { list: async () => [{ id: "school-1" }] },
      },
      forActor: () => ({
        baseService: {
          repositories: {
            accountInvitations: { list: async () => [] },
          },
          invitationDelivery: { revoke: async () => undefined },
        },
      }),
    } as unknown as ApiSchoolApplication;
    const runtime = {
      getSchoolApplication: mock(async () => application),
    } as unknown as ApiRuntime;

    const summary = await runScheduledCronWithRuntime(runtime, {
      asOf: new Date("2026-07-07T12:00:00.000Z"),
      jobKeys: ["expireAccountInvitations"],
      requestIdPrefix: "local-cron",
    });

    expect(summary.results).toHaveLength(1);
    expect(summary.results[0]).toMatchObject({
      schoolId: "school-1",
      jobKey: "expireAccountInvitations",
      result: { processed: 0, skipped: 0 },
    });
  });
});
