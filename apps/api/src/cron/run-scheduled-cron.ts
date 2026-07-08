import type { LoggerPort } from "@edaya/core";
import type { CronHeartbeatSummary, CronJobDispatcherPort, CronJobKey } from "@edaya/school-service";
import { computeNextRunAt, createInlineCronJobDispatcher, runCronJobs, tickCronSchedules } from "@edaya/school-service";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { resolveCronJobDispatcher } from "@/runtime/worker/resolve-cron-job-dispatcher";
import type { ApiRuntime } from "@/runtime/types";

export interface RunScheduledCronOptions {
  asOf: Date;
  jobKeys?: readonly CronJobKey[];
  requestIdPrefix: string;
}

export interface RunCronHeartbeatOptions {
  asOf: Date;
  requestIdPrefix: string;
  dispatcher?: CronJobDispatcherPort;
}

export function parseCronJobKeysFilter(value: string | undefined): readonly CronJobKey[] | undefined {
  const jobKeys = value?.split(",").map(key => key.trim()).filter(Boolean);
  if (!jobKeys || jobKeys.length === 0) {
    return undefined;
  }

  return jobKeys as CronJobKey[];
}

export async function runCronHeartbeat(
  application: ApiSchoolApplication,
  options: RunCronHeartbeatOptions,
  logger?: LoggerPort,
): Promise<CronHeartbeatSummary> {
  const dispatcher = options.dispatcher ?? createInlineCronJobDispatcher(application);

  const summary = await tickCronSchedules({
    schedules: application.repositories.cronJobSchedules,
    dispatcher,
    listSchoolIds: async () => (await application.repositories.schools.list()).map(school => school.id),
    computeNextRunAt,
  }, options);

  logger?.info({
    event: "cron.tick",
    asOf: options.asOf.toISOString(),
    dispatchCount: summary.dispatches.length,
    dispatches: summary.dispatches.map(dispatch => ({
      jobKey: dispatch.jobKey,
      schoolId: dispatch.schoolId,
      requestId: dispatch.requestId,
    })),
  }, "cron heartbeat tick completed");

  return summary;
}

export async function runCronHeartbeatWithRuntime(
  runtime: ApiRuntime,
  options: RunCronHeartbeatOptions,
  logger?: LoggerPort,
): Promise<CronHeartbeatSummary> {
  const application = await runtime.getSchoolApplication();
  const dispatcher = options.dispatcher
    ?? resolveCronJobDispatcher(runtime.env, application, logger);

  return runCronHeartbeat(application, { ...options, dispatcher }, logger);
}

/** Direct job execution bypassing the schedule table — for local debugging via CRON_JOB_KEYS. */
export async function runScheduledCronWithRuntime(
  runtime: ApiRuntime,
  options: RunScheduledCronOptions,
) {
  const application = await runtime.getSchoolApplication();
  return runCronJobs(application, {
    asOf: options.asOf,
    jobKeys: options.jobKeys,
    requestIdPrefix: options.requestIdPrefix,
  });
}
