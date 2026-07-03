import { describe, expect, test } from "bun:test";
import {
  parseCronJobDispatchQueueBody,
  toCronJobDispatchQueueBody,
} from "@/cron/cron-job-dispatch-payload";
import { createCloudflareQueueCronJobDispatcher } from "@/runtime/worker/adapters/cloudflare-queue-cron-job-dispatcher";
import { resolveCronJobDispatcher } from "@/runtime/worker/resolve-cron-job-dispatcher";

describe("cron job dispatch payload", () => {
  test("round-trips queue bodies", () => {
    const message = {
      jobKey: "reconcilePendingDeliveries" as const,
      schoolId: "school-1",
      asOf: new Date("2026-07-03T12:00:00.000Z"),
      requestId: "worker-cron:reconcilePendingDeliveries:school-1:2026-07-03T12:00:00.000Z",
    };

    const body = toCronJobDispatchQueueBody(message);
    expect(body).toEqual({
      jobKey: "reconcilePendingDeliveries",
      schoolId: "school-1",
      asOf: "2026-07-03T12:00:00.000Z",
      requestId: message.requestId,
    });
    expect(parseCronJobDispatchQueueBody(body)).toEqual(message);
  });
});

describe("createCloudflareQueueCronJobDispatcher", () => {
  test("sends serialized queue bodies", async () => {
    const sent: unknown[] = [];
    const dispatcher = createCloudflareQueueCronJobDispatcher({
      send: async (message) => {
        sent.push(message);
      },
    });

    await dispatcher.dispatch({
      jobKey: "processDueNotifications",
      schoolId: "school-2",
      asOf: new Date("2026-07-03T06:00:00.000Z"),
      requestId: "req-1",
    });

    expect(sent).toEqual([{
      jobKey: "processDueNotifications",
      schoolId: "school-2",
      asOf: "2026-07-03T06:00:00.000Z",
      requestId: "req-1",
    }]);
  });
});

describe("resolveCronJobDispatcher", () => {
  test("uses the queue dispatcher on worker when CRON_JOBS is bound", () => {
    const application = { forActor: () => ({}), repositories: {} } as any;
    const dispatcher = resolveCronJobDispatcher(
      {
        RUNTIME: "worker",
        CRON_JOBS: { send: async () => {} },
      } as any,
      application,
    );

    expect(dispatcher.dispatch).toBeFunction();
  });

  test("falls back to inline dispatcher on local runtime", () => {
    const application = { forActor: () => ({}), repositories: {} } as any;
    const dispatcher = resolveCronJobDispatcher(
      { RUNTIME: "local" } as any,
      application,
    );

    expect(dispatcher.dispatch).toBeFunction();
  });
});
