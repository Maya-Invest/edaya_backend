/// <reference types="@cloudflare/workers-types" />
import { isPaused, maintenanceResponse } from "@/operational-controls";
import { listTemplateDefinitions } from "@edaya/adaptor-docs";

import type { CronJobDispatchQueueBody } from "@/cron/cron-job-dispatch-payload";

// AJV uses code generation, which Workers allow only during module initialization.
// Keep document validators eager while deferring the rest of the application.
listTemplateDefinitions();

export default {
  async fetch(request: Request, bindings: Record<string, unknown>, executionCtx: ExecutionContext) {
    if (isPaused(bindings, "PAUSE_API"))
      return maintenanceResponse();
    // Initialize application schemas inside the event's CPU budget, once per isolate.
    const [{ default: app }, { parseRuntimeEnv }] = await Promise.all([
      import("@/app"),
      import("@/runtime/shared/env"),
    ]);
    const env = parseRuntimeEnv(bindings, "worker");
    return app.fetch(request, env, executionCtx);
  },

  async scheduled(controller: ScheduledController, bindings: Record<string, unknown>, ctx: ExecutionContext) {
    if (isPaused(bindings, "PAUSE_SCHEDULER"))
      return;
    const [{ parseRuntimeEnv }, { createAppLogger }, { buildWorkerApiRuntime }, { runHeartbeatJobs }, { runCronHeartbeatWithRuntime }] = await Promise.all([
      import("@/runtime/shared/env"),
      import("@/runtime/shared/adapters/pino-logger"),
      import("@/runtime/worker/build-runtime"),
      import("@/identity/jobs"),
      import("@/cron/run-scheduled-cron"),
    ]);
    const env = parseRuntimeEnv(bindings, "worker");
    const logger = createAppLogger(env);
    const runtime = await buildWorkerApiRuntime(env);

    ctx.waitUntil((async () => {
      try {
        const asOf = new Date(controller.scheduledTime);
        if (env.SCHEDULER_MODE === "active") {
          const { tickScheduler } = await import("@/cron/scheduler/runtime");
          const claimed = await tickScheduler(runtime, Math.max(Date.now(), asOf.getTime()));
          logger.info({ event: "scheduler.tick", claimed, ...runtime.schedulerUsage?.(), scheduledAt: asOf.toISOString() }, "D1 heartbeat completed");
          return;
        }
        let advanceShadow: (() => Promise<void>) | undefined;
        if (env.SCHEDULER_MODE === "shadow") {
          try {
            const { compareShadow } = await import("@/cron/scheduler/shadow");
            advanceShadow = await compareShadow(runtime, asOf, logger);
          }
          catch (error) {
            logger.error({ event: "scheduler.shadow.failed", err: error }, "shadow comparison failed");
          }
        }
        await runHeartbeatJobs(asOf, async () => {
          await runtime.getSchoolApplication();
          await runtime.drainNotifications?.();
          await runCronHeartbeatWithRuntime(runtime, { asOf, requestIdPrefix: `worker-cron:${asOf.toISOString()}` }, logger);
        }, async () => (await runtime.getIdentityRuntime!()).auth.purgeExpiredCredentials(), env.LEGACY_IDENTITY_CLEANUP_CRON);
        await advanceShadow?.();
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
    const [{ parseRuntimeEnv }, { createAppLogger }, { buildWorkerApiRuntime }, { runCronQueueBatch }] = await Promise.all([
      import("@/runtime/shared/env"),
      import("@/runtime/shared/adapters/pino-logger"),
      import("@/runtime/worker/build-runtime"),
      import("@/cron/run-cron-queue-consumer"),
    ]);
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
