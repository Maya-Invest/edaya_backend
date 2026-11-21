import type { MessageBatch } from "@cloudflare/workers-types";
import type { LoggerPort } from "@edaya/core";
import type { ApiRuntime } from "@/runtime/types";
import { consumeScheduler, publishSchoolChanges, tickScheduler } from "./scheduler/runtime";
import { isSchedulerMessage } from "./scheduler/dispatch";
import { executeCronOccurrence } from "@edaya/service";
import { parseCronJobDispatchQueueBody } from "@/cron/cron-job-dispatch-payload";

export async function runCronQueueBatch(
  runtime: ApiRuntime,
  batch: Pick<MessageBatch<unknown>, "messages">,
  logger: LoggerPort,
): Promise<void> {
  for (const message of batch.messages) {
    if (isSchedulerMessage(message.body)) {
      try {
        if (runtime.env.SCHEDULER_MODE === "active") {
          await consumeScheduler(runtime, message.body);
          await tickScheduler(runtime, Date.now());
        }
        message.ack();
      }
      catch {
        logger.error({ event: "scheduler.failure", ref: message.body.ref, code: "SCHEDULER_PERSISTENCE_FAILED" }, "scheduler delivery failed");
        message.retry({ delaySeconds: 60 });
      }
      continue;
    }
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
      const disposition = await executeCronOccurrence(await runtime.getSchoolApplication(), payload.jobId);
      if (runtime.env?.SCHEDULER_MODE === "active")
        await publishSchoolChanges(runtime);
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
