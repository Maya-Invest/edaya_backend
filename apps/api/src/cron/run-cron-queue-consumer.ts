import type { MessageBatch } from "@cloudflare/workers-types";
import { runCronJobForSchool } from "@edaya/service";
import type { LoggerPort } from "@edaya/core";
import type { CronJobDispatchQueueBody } from "@/cron/cron-job-dispatch-payload";
import { parseCronJobDispatchQueueBody } from "@/cron/cron-job-dispatch-payload";
import type { ApiRuntime } from "@/runtime/types";

export async function runCronQueueBatch(
  runtime: ApiRuntime,
  batch: MessageBatch<CronJobDispatchQueueBody>,
  logger: LoggerPort,
): Promise<void> {
  const application = await runtime.getSchoolApplication();

  for (const message of batch.messages) {
    const payload = parseCronJobDispatchQueueBody(message.body);

    try {
      const result = await runCronJobForSchool(application, {
        jobKey: payload.jobKey,
        schoolId: payload.schoolId,
        asOf: payload.asOf,
        requestId: payload.requestId,
      });

      logger.info({
        event: "cron.execute",
        jobKey: payload.jobKey,
        schoolId: payload.schoolId,
        requestId: payload.requestId,
        asOf: payload.asOf.toISOString(),
        processed: result.result.processed,
        skipped: result.result.skipped,
      }, "cron job executed");
      message.ack();
    }
    catch (error) {
      logger.error({
        event: "cron.execute",
        err: error,
        jobKey: payload.jobKey,
        schoolId: payload.schoolId,
        requestId: payload.requestId,
      }, "cron job execution failed");
      message.retry();
    }
  }
}
