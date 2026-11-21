import { resolveCronJobDispatcher } from "./resolve-cron-job-dispatcher";
import { createAppLogger } from "@/runtime/shared/adapters/pino-logger";
import { SqliteScheduler } from "@/runtime/shared/adapters/sqlite-scheduler";
import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createSchoolDatabase } from "@/runtime/worker/school-database";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime, DatabaseHandle } from "@/runtime/types";

export async function buildWorkerApiRuntime(env: Environment): Promise<ApiRuntime> {
  let schoolHandlePromise: Promise<DatabaseHandle> | null = null;

  const runtime = await createApiRuntime({
    env,
    resolveSchoolHandle: async () => {
      schoolHandlePromise ??= createSchoolDatabase(env);
      return schoolHandlePromise;
    },
    initSchoolApplication: (db, extras) => buildSchoolApplication(db, {
      env,
      identityDirectory: extras.identityClient.directory,
      notifyRuntime: extras.notifyRuntime,
    }),
  });
  const scheduler = env.SCHEDULER_DB ? new SqliteScheduler(env.SCHEDULER_DB) : undefined;
  return {
    ...runtime,
    scheduler,
    legacyCronDispatcher: app => resolveCronJobDispatcher(env, app),
    schedulerUsage: scheduler ? () => scheduler.usage : undefined,
    schedulerStarted: (work, at) => createAppLogger(env).info({
      event: "scheduler.start",
      ref: work.ref,
      kind: work.kind,
      attempt: work.attempts,
      lateMs: work.dueAt ? Math.max(0, at - work.dueAt) : 0,
    }, "scheduler execution started"),
    sendSchedulerMessage: env.CRON_JOBS?.send.bind(env.CRON_JOBS),
  };
}
