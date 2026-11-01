import type { LoggerPort } from "@edaya/core";
import type { ApiRuntime } from "@/runtime/types";
import { expect, mock, test } from "bun:test";
import { runCronQueueBatch } from "@/cron/run-cron-queue-consumer";
import { runCronHeartbeat } from "@/cron/run-scheduled-cron";
import { useNativePolicyApps } from "../support/native-policy-app";

const createNativePolicyApp = useNativePolicyApps();

function message(body: unknown) {
  return { id: crypto.randomUUID(), timestamp: new Date(), body, attempts: 1, ack: mock(() => {}), retry: mock(() => {}) };
}
function logger() {
  const write = mock(() => {});
  const value: LoggerPort = { child: () => value, trace: write, debug: write, info: write, warn: write, error: write, fatal: write };
  return { value, write };
}

test("queue consumer discards injected authority and continues through duplicate or unknown references", async () => {
  const { school, db } = await createNativePolicyApp();
  await db.exec(`DELETE FROM cron_job_schedules;
    INSERT INTO cron_job_schedules (id, job_key, cron_expression, enabled, next_run_at, created_at, updated_at)
    VALUES ('queue-fixture', 'expireAccountInvitations', '*/5 * * * *', true, '2026-07-07T12:00:00Z', now(), now())`);
  const sent: { jobId: string }[] = [];
  await runCronHeartbeat(school, {
    asOf: new Date("2026-07-07T12:00:00Z"),
    requestIdPrefix: "queue-fixture",
    dispatcher: { dispatch: async (body) => { sent.push(body); } },
  });
  const messages = [
    message({ ...sent[0], schoolId: "foreign", secret: "DO-NOT-LOG" }),
    message(sent[0]),
    message(sent[0]),
    message({ jobId: `cron-execute:${crypto.randomUUID()}` }),
  ];
  const logs = logger();
  await runCronQueueBatch({ getSchoolApplication: async () => school } as ApiRuntime, { messages }, logs.value);
  for (const item of messages) {
    expect(item.ack).toHaveBeenCalledTimes(1);
    expect(item.retry).not.toHaveBeenCalled();
  }
  expect(JSON.stringify(logs.write.mock.calls)).not.toContain("DO-NOT-LOG");
  expect((await db.query("SELECT attempts FROM command_outbox WHERE kind = 'cron.execute' AND status = 'completed'")).rows).toEqual([{ attempts: 1 }]);
});

test("queue consumer retries infrastructure failures with a stable safe log code", async () => {
  const { school } = await createNativePolicyApp();
  school.durableWork.claim = async () => {
    throw new Error("provider-secret=PRIVATE");
  };
  const item = message({ jobId: `cron-execute:${crypto.randomUUID()}` });
  const logs = logger();
  await runCronQueueBatch({ getSchoolApplication: async () => school } as ApiRuntime, { messages: [item] }, logs.value);
  expect(item.ack).not.toHaveBeenCalled();
  expect(item.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
  expect(JSON.stringify(logs.write.mock.calls)).toContain("CRON_PERSISTENCE_FAILED");
  expect(JSON.stringify(logs.write.mock.calls)).not.toContain("PRIVATE");
});
