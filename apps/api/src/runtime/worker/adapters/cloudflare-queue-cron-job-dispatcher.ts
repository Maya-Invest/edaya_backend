import type { LoggerPort } from "@edaya/core";
import type { CronJobDispatcherPort, CronJobDispatchMessage } from "@edaya/school-service";
import { toCronJobDispatchQueueBody } from "@/cron/cron-job-dispatch-payload";

export interface CronJobsQueueBinding {
  send: (message: unknown) => Promise<void>;
}

export function createCloudflareQueueCronJobDispatcher(
  queue: CronJobsQueueBinding,
  logger?: LoggerPort,
): CronJobDispatcherPort {
  return {
    dispatch: async (message: CronJobDispatchMessage) => {
      const body = toCronJobDispatchQueueBody(message);
      await queue.send(body);
      logger?.info({
        event: "cron.dispatch",
        jobKey: body.jobKey,
        schoolId: body.schoolId,
        requestId: body.requestId,
        asOf: body.asOf,
      }, "cron job dispatched to queue");
    },
  };
}
