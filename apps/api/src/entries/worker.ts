/// <reference types="@cloudflare/workers-types" />
import { isPaused, maintenanceResponse } from "@/operational-controls";

import { runIndependentJobs } from "@/identity/jobs";
import app from "@/app";
import type { CronJobDispatchQueueBody } from "@/cron/cron-job-dispatch-payload";
import { runCronQueueBatch } from "@/cron/run-cron-queue-consumer";
import { runCronHeartbeatWithRuntime } from "@/cron/run-scheduled-cron";
import { createAppLogger } from "@/runtime/shared/adapters/pino-logger";
import { buildWorkerApiRuntime } from "@/runtime/worker/build-runtime";
import { parseRuntimeEnv } from "@/runtime/shared/env";

export default {
  async fetch(request: Request, bindings: Record<string, unknown>, executionCtx: ExecutionContext) {
    if (isPaused(bindings, "PAUSE_API"))
      return maintenanceResponse();
    const env = parseRuntimeEnv(bindings, "worker");
    return app.fetch(request, env, executionCtx);
  },

  async scheduled(controller: ScheduledController, bindings: Record<string, unknown>, ctx: ExecutionContext) {
    if (isPaused(bindings, "PAUSE_SCHEDULER"))
      return;
    const env = parseRuntimeEnv(bindings, "worker");
    const logger = createAppLogger(env);
    const runtime = await buildWorkerApiRuntime(env);

    ctx.waitUntil((async () => {
      try {
        const asOf = new Date(controller.scheduledTime);
        await runIndependentJobs([
          async () => (await runtime.getIdentityRuntime!()).auth.purgeExpiredCredentials(),
          async () => {
            await runtime.getSchoolApplication();
            await runtime.drainNotifications?.();
            await runCronHeartbeatWithRuntime(runtime, { asOf, requestIdPrefix: `worker-cron:${asOf.toISOString()}` }, logger);
          },
        ]);
      }
      catch (error) {
        logger.error({ event: "cron.tick", err: error, cron: controller.cron }, "cron heartbeat failed");
        throw error;
      }
      finally {
        await runtime.close();
      }
    })());
  },

  async queue(batch: MessageBatch<CronJobDispatchQueueBody>, bindings: Record<string, unknown>) {
    if (isPaused(bindings, "PAUSE_JOBS")) {
      batch.retryAll({ delaySeconds: 60 });
      return;
    }
    const env = parseRuntimeEnv(bindings, "worker");
    const logger = createAppLogger(env);
    const runtime = await buildWorkerApiRuntime(env);

    try {
      await runCronQueueBatch(runtime, batch, logger);
    }
    finally {
      await runtime.close();
    }
  },
} satisfies ExportedHandler<Record<string, unknown>, CronJobDispatchQueueBody>;
