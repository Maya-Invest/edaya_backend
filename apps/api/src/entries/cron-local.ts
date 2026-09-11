import { loadLocalProcessEnv } from "@/runtime";
import { buildLocalApiRuntime } from "@/runtime/local/build-runtime";
import {
  parseCronJobKeysFilter,
  runCronHeartbeatWithRuntime,
  runScheduledCronWithRuntime,
} from "@/cron/run-scheduled-cron";
import { createAppLogger } from "@/runtime/shared/adapters/pino-logger";

async function main(): Promise<void> {
  const env = loadLocalProcessEnv();
  const logger = createAppLogger(env);
  const runtime = await buildLocalApiRuntime(env);

  try {
    await runtime.getSchoolApplication();
    await runtime.drainNotifications?.();
    const asOf = new Date();
    const jobKeys = parseCronJobKeysFilter(env.CRON_JOB_KEYS);

    if (jobKeys) {
      const summary = await runScheduledCronWithRuntime(runtime, {
        asOf,
        jobKeys,
        requestIdPrefix: `local-cron:${asOf.toISOString()}`,
      });

      const totalProcessed = summary.results.reduce((sum, r) => sum + r.result.processed, 0);
      const totalSkipped = summary.results.reduce((sum, r) => sum + r.result.skipped, 0);

      logger.info({
        summary,
        totalProcessed,
        totalSkipped,
        runCount: summary.results.length,
      }, "cron jobs completed (CRON_JOB_KEYS filter)");
      return;
    }

    const summary = await runCronHeartbeatWithRuntime(runtime, {
      asOf,
      requestIdPrefix: `local-cron:${asOf.toISOString()}`,
    });

    logger.info({
      summary,
      dispatchCount: summary.dispatches.length,
    }, "cron heartbeat completed");
  }
  finally {
    await runtime.close();
  }
}

main().catch((error) => {
  console.error("Cron run failed:", error);
  process.exit(1);
});
