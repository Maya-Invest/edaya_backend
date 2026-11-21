import type { SchedulerMessage, SchedulerPort, SchedulerWork } from "@edaya/service";
import { schedulerMaxAttempts as maxHandoffs } from "@edaya/service";

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
export function isSchedulerRef(value: unknown): value is string {
  return (
    typeof value === "string"
    && (uuid.test(value) || value === "school-recovery" || value === "identity-cleanup" || value === "school-publish")
  );
}
export function isSchedulerMessage(value: unknown): value is SchedulerMessage {
  if (!value || typeof value !== "object")
    return false;
  const v = value as Partial<SchedulerMessage>;
  return (
    Object.keys(v).length === 3
    && v.version === 1
    && isSchedulerRef(v.ref)
    && typeof v.lease === "string"
    && uuid.test(v.lease)
  );
}

export async function dispatchScheduler(
  store: SchedulerPort,
  send: (message: SchedulerMessage) => Promise<void>,
  now: number,
  environment: string,
) {
  const work = await store.claim(now);
  for (const item of work) {
    if (item.exhausted) {
      reportFailure(item, environment, "SCHEDULER_RETRIES_EXHAUSTED");
      continue;
    }
    try {
      await send({ version: 1, ref: item.ref, lease: item.lease! });
    }
    catch {
      reportFailure(item, environment, "QUEUE_HANDOFF_FAILED");
      await store.fail(item, now, "QUEUE_HANDOFF_FAILED");
      if (item.attempts >= maxHandoffs)
        reportFailure(item, environment, "SCHEDULER_RETRIES_EXHAUSTED");
    }
  }
  return work.length;
}

export function reportFailure(
  item: Pick<SchedulerWork, "ref" | "kind" | "attempts">,
  environment: string,
  code: string,
) {
  console.error(
    JSON.stringify({
      event: "scheduler.failure",
      environment,
      ref: item.ref,
      kind: item.kind,
      attempt: item.attempts,
      code,
    }),
  );
}
