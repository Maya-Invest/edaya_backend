import type { LoggerPort } from "@edaya/core";
import type { CronJobDispatcherPort } from "@edaya/school-service";
import { createInlineCronJobDispatcher } from "@edaya/school-service";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { Environment } from "@/runtime/shared/env/schema";
import { createCloudflareQueueCronJobDispatcher } from "@/runtime/worker/adapters/cloudflare-queue-cron-job-dispatcher";

export function resolveCronJobDispatcher(
  env: Environment,
  application: ApiSchoolApplication,
  logger?: LoggerPort,
): CronJobDispatcherPort {
  if (env.RUNTIME === "worker" && env.CRON_JOBS) {
    return createCloudflareQueueCronJobDispatcher(env.CRON_JOBS, logger);
  }

  if (env.RUNTIME === "worker" && !env.CRON_JOBS) {
    logger?.warn({ event: "cron.dispatch" }, "CRON_JOBS queue binding missing; falling back to inline dispatcher");
  }

  return createInlineCronJobDispatcher(application);
}
