import type { LoggerPort } from "@edaya/core";
import type { ApiRuntime } from "@/runtime/types";
import { describe, expect, mock, spyOn, test } from "bun:test";
import {
  parseCronJobKeysFilter,
  runCronHeartbeat,
  runCronHeartbeatWithRuntime,
  runScheduledCronWithRuntime,
} from "@/cron/run-scheduled-cron";
import { useNativePolicyApps } from "../support/native-policy-app";

const createNativePolicyApp = useNativePolicyApps();

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
  test("dispatches only for schools with pending deliveries and logs the tick summary", async () => {
    const dispatch = mock(async () => undefined);
    const { school: application, db } = await createNativePolicyApp();
    await db.exec(`DELETE FROM cron_job_schedules;
      INSERT INTO message_deliveries (id, school_id, subject_id, title, body, event_key, status, created_at, updated_at)
      SELECT 'cron-test-' || id, id, 'test-subject', 'Title', 'Body', 'test.event', 'pending', now(), now()
      FROM schools WHERE id = 'school-a';
    INSERT INTO cron_job_schedules (id, job_key, cron_expression, enabled, next_run_at, created_at, updated_at)
      VALUES ('sched-1', 'reconcilePendingDeliveries', '*/5 * * * *', true, '2026-07-07T12:00:00Z', now(), now())`);
    const info = mock(() => undefined);
    const logger = { info } as unknown as LoggerPort;
    const asOf = new Date("2026-07-07T12:00:00.000Z");

    const summary = await runCronHeartbeat(application, {
      asOf,
      requestIdPrefix: "test-cron",
      dispatcher: { dispatch },
    }, logger);

    expect(summary.dispatches).toHaveLength(1);
    expect(summary.dispatches[0]?.jobId).toStartWith("cron-execute:");
    expect(dispatch).toHaveBeenCalledTimes(1);

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cron.tick",
        dispatchCount: 1,
      }),
      "cron heartbeat tick completed",
    );
  });
});

describe("runCronHeartbeatWithRuntime", () => {
  test("loads the school application from runtime and forwards the dispatcher", async () => {
    const { school: application, db } = await createNativePolicyApp();
    await db.exec("DELETE FROM cron_job_schedules");
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
    const { school: application } = await createNativePolicyApp();
    const actors = spyOn(application, "forActor");
    const runtime = {
      getSchoolApplication: mock(async () => application),
    } as unknown as ApiRuntime;

    const summary = await runScheduledCronWithRuntime(runtime, {
      asOf: new Date("2026-07-07T12:00:00.000Z"),
      jobKeys: ["expireAccountInvitations"],
      requestIdPrefix: "local-cron",
    });

    expect(summary.results).toHaveLength(2);
    expect(actors.mock.calls.map(([actor]) => actor)).toEqual([
      expect.objectContaining({ kind: "system", schoolId: "school-a", systemId: "expireAccountInvitations" }),
      expect.objectContaining({ kind: "system", schoolId: "school-b", systemId: "expireAccountInvitations" }),
    ]);
    expect(summary.results[0]).toMatchObject({
      schoolId: "school-a",
      jobKey: "expireAccountInvitations",
      result: { processed: 0, skipped: 0 },
    });
  });
});
