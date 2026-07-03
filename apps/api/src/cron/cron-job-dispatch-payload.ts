import type { CronJobDispatchMessage, CronJobKey } from "@edaya/core";

/** JSON-safe queue body for Cloudflare Queues. */
export interface CronJobDispatchQueueBody {
  jobKey: CronJobKey;
  schoolId: string;
  asOf: string;
  requestId: string;
}

export function toCronJobDispatchQueueBody(message: CronJobDispatchMessage): CronJobDispatchQueueBody {
  return {
    jobKey: message.jobKey,
    schoolId: message.schoolId,
    asOf: message.asOf.toISOString(),
    requestId: message.requestId,
  };
}

export function parseCronJobDispatchQueueBody(body: CronJobDispatchQueueBody): CronJobDispatchMessage {
  return {
    jobKey: body.jobKey,
    schoolId: body.schoolId,
    asOf: new Date(body.asOf),
    requestId: body.requestId,
  };
}
