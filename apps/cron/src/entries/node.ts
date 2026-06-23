import { runCronJobs } from "@edaya/core";
import { buildNodeCronRuntime, loadNodeProcessEnv } from "@/runtime";
import { createAppLogger } from "@/logging/app-logger";

async function main(): Promise<void> {
  const env = loadNodeProcessEnv();
  const logger = createAppLogger(env);
  const runtime = await buildNodeCronRuntime(env);

  try {
    const application = await runtime.getSchoolApplication();
    const asOf = new Date();
    const summary = await runCronJobs(application, {
      asOf,
      requestIdPrefix: `node-cron:${asOf.toISOString()}`,
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
