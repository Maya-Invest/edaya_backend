import { describe, expect, test } from "bun:test";
import {
  parseCronJobDispatchQueueBody,
  toCronJobDispatchQueueBody,
} from "@/cron/cron-job-dispatch-payload";
import { createCloudflareQueueCronJobDispatcher } from "@/runtime/worker/adapters/cloudflare-queue-cron-job-dispatcher";
import { resolveCronJobDispatcher } from "@/runtime/worker/resolve-cron-job-dispatcher";

describe("cron job dispatch payload", () => {
  test("round-trips queue bodies", () => {
    const message = { jobId: `cron-execute:${crypto.randomUUID()}` };
    const body = toCronJobDispatchQueueBody(message);
    expect(body).toEqual(message);
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

    const message = { jobId: `cron-execute:${crypto.randomUUID()}` };
    await dispatcher.dispatch(message);
    expect(sent).toEqual([message]);
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

test("rejects mutable authority, legacy payloads and malformed references", () => {
  const jobId = `cron-execute:${crypto.randomUUID()}`;
  for (const payload of [null, [], {}, { jobId: "" }, { jobId: 1 }, { jobId, schoolId: "foreign" }, { jobId, jobKey: "expireAccountInvitations" }, { schoolId: "school-a", jobKey: "expireAccountInvitations", asOf: "2026-07-07" }])
    expect(() => parseCronJobDispatchQueueBody(payload)).toThrow("CRON_QUEUE_PAYLOAD_INVALID");
});

test("worker missing queue binding fails closed", () => {
  expect(() => resolveCronJobDispatcher({ RUNTIME: "worker" } as any, {} as any)).toThrow("CRON_JOBS");
});
