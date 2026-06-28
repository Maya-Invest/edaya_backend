import { runCronJobs } from "@edaya/core";
import { buildLocalCronRuntime, loadLocalProcessEnv } from "@/runtime";
import { createAppLogger } from "@/logging/app-logger";

async function main(): Promise<void> {
  const env = loadLocalProcessEnv();
  const logger = createAppLogger(env);
  const runtime = await buildLocalCronRuntime(env);

  try {
    const application = await runtime.getSchoolApplication();
    const asOf = new Date();
    const jobKeys = env.CRON_JOB_KEYS?.split(",").map(key => key.trim()).filter(Boolean);
    const summary = await runCronJobs(application, {
      asOf,
      ...(jobKeys && jobKeys.length > 0 ? { jobKeys: jobKeys as import("@edaya/core").CronJobKey[] } : {}),
      requestIdPrefix: `local-cron:${asOf.toISOString()}`,
    });

    logger.info({ summary }, "cron jobs completed");
    const totalProcessed = summary.results.reduce((sum, r) => sum + r.result.processed, 0);
    const totalSkipped = summary.results.reduce((sum, r) => sum + r.result.skipped, 0);

    console.info(`Processed ${totalProcessed} items, skipped ${totalSkipped} across ${summary.results.length} school-job runs`);
  }
  finally {
    await runtime.close();
  }
}

main().catch((error) => {
  console.error("Cron run failed:", error);
  process.exit(1);
});
