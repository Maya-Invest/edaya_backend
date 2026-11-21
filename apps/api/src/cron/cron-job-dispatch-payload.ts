import type { CronJobDispatchMessage } from "@edaya/service";

export type CronJobDispatchQueueBody = CronJobDispatchMessage | import("@edaya/service").SchedulerMessage;

export function parseCronJobDispatchQueueBody(body: unknown): CronJobDispatchMessage {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("CRON_QUEUE_PAYLOAD_INVALID");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || typeof value.jobId !== "string"
    || !/^cron-execute:[0-9a-f-]{36}$/.test(value.jobId)) {
    throw new Error("CRON_QUEUE_PAYLOAD_INVALID");
  }
  return { jobId: value.jobId };
}

export function toCronJobDispatchQueueBody(message: CronJobDispatchMessage): CronJobDispatchMessage {
  return parseCronJobDispatchQueueBody(message);
}
