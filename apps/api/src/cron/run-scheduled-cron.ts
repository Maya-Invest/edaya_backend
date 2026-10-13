import type { LoggerPort } from "@edaya/core";
import type { CronHeartbeatSummary, CronJobDispatcherPort, CronJobKey } from "@edaya/service";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ApiRuntime } from "@/runtime/types";
import { computeNextRunAt, createInlineCronJobDispatcher, dispatchConversationNotifications, dispatchDocumentRender, dispatchGradingRecalculation, dispatchPrivateFileCleanup, runCronJobs, tickCronSchedules } from "@edaya/service";
import { resolveCronJobDispatcher } from "@/runtime/worker/resolve-cron-job-dispatcher";

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
    application,
    dispatcher,
    computeNextRunAt,
  }, options);

  await dispatchGradingRecalculation(application);
  await dispatchPrivateFileCleanup(application);
  await dispatchDocumentRender(application);
  await dispatchConversationNotifications(application);
  logger?.info({
    event: "cron.tick",
    asOf: options.asOf.toISOString(),
    dispatchCount: summary.dispatches.length,
    dispatches: summary.dispatches.map(dispatch => ({
      jobId: dispatch.jobId,
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
  const summary = await runCronJobs(application, {
    asOf: options.asOf,
    jobKeys: options.jobKeys,
    requestIdPrefix: options.requestIdPrefix,
  });
  await dispatchGradingRecalculation(application);
  await dispatchPrivateFileCleanup(application);
  await dispatchDocumentRender(application);
  await dispatchConversationNotifications(application);
  return summary;
}
