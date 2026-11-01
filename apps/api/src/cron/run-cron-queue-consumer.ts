import type { MessageBatch } from "@cloudflare/workers-types";
import type { LoggerPort } from "@edaya/core";
import type { ApiRuntime } from "@/runtime/types";
import { executeCronOccurrence } from "@edaya/service";
import { parseCronJobDispatchQueueBody } from "@/cron/cron-job-dispatch-payload";

export async function runCronQueueBatch(
  runtime: ApiRuntime,
  batch: Pick<MessageBatch<unknown>, "messages">,
  logger: LoggerPort,
): Promise<void> {
  const application = await runtime.getSchoolApplication();
  for (const message of batch.messages) {
    let payload;
    try {
      payload = parseCronJobDispatchQueueBody(message.body);
    }
    catch {
      logger.warn({ event: "cron.execute", code: "CRON_QUEUE_PAYLOAD_INVALID" }, "invalid cron message discarded");
      message.ack();
      continue;
    }
    try {
      const disposition = await executeCronOccurrence(application, payload.jobId);
      if (disposition === "ack")
        message.ack();
      else
        message.retry({ delaySeconds: 60 });
      logger.info({ event: "cron.execute", jobId: payload.jobId, disposition }, "cron delivery processed");
    }
    catch {
      logger.error({ event: "cron.execute", jobId: payload.jobId, code: "CRON_PERSISTENCE_FAILED" }, "cron delivery failed");
      message.retry({ delaySeconds: 60 });
    }
  }
}
