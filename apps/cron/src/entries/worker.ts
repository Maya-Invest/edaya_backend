/// <reference types="@cloudflare/workers-types" />

import { resolveCronJobKeys, runCronJobs } from "@edaya/core";
import { buildWorkerCronRuntime, parseRuntimeEnv } from "@/runtime";
import { createAppLogger } from "@/logging/app-logger";

export default {
  async scheduled(controller: ScheduledController, bindings: Record<string, unknown>, ctx: ExecutionContext) {
    const env = parseRuntimeEnv(bindings, "worker");
    const logger = createAppLogger(env);
    const runtime = await buildWorkerCronRuntime(env);

    ctx.waitUntil((async () => {
      try {
        const application = await runtime.getSchoolApplication();
        const asOf = new Date(controller.scheduledTime);
        const summary = await runCronJobs(application, {
          asOf,
          jobKeys: resolveCronJobKeys(controller.cron),
          requestIdPrefix: `worker-cron:${controller.cron}:${asOf.toISOString()}`,
        });
        logger.info({ cron: controller.cron, summary }, "scheduled cron jobs completed");
      }
      catch (error) {
        logger.error({ err: error, cron: controller.cron }, "scheduled cron jobs failed");
        throw error;
      }
      finally {
        await runtime.close();
      }
    })());
  },
} satisfies ExportedHandler<Record<string, unknown>>;
