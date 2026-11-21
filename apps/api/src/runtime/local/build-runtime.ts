import { createInlineCronJobDispatcher } from "@edaya/service";
import { SqliteScheduler } from "@/runtime/shared/adapters/sqlite-scheduler";
import { consumeScheduler } from "@/cron/scheduler/runtime";
import { localSchedulerPath, openLocalScheduler } from "./scheduler-database";
import { localOperations } from "../../../configuration/local-operations.ts";
import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { runMigrationsOnStartup } from "@/runtime/local/profile";
import { createSchoolDatabase } from "@/runtime/local/school-database";
import { runStartupMigrations } from "@/runtime/shared/run-startup-migrations";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";
import type { IdentityClient } from "../../identity/server/index";

export async function buildLocalApiRuntime(env: Environment, extras?: { identityClient?: IdentityClient }): Promise<ApiRuntime> {
  if (env.RUNTIME !== "local") {
    throw new Error("buildLocalApiRuntime() requires RUNTIME=local.");
  }

  const runMigrations = runMigrationsOnStartup(env);
  let pending: Promise<import("@/runtime/types").DatabaseHandle> | undefined;
  const localScheduler
    = env.SCHEDULER_MODE && env.SCHEDULER_MODE !== "legacy" ? openLocalScheduler(localSchedulerPath(env)) : undefined;
  const runtime = await createApiRuntime({
    env,
    runBackground: work => localOperations(env).background(["PAUSE_JOBS"], work),
    identityClient: extras?.identityClient,
    resolveSchoolHandle: () =>
      (pending ??= (async () => {
        const handle = await createSchoolDatabase(env);
        try {
          if (runMigrations)
            await runStartupMigrations(handle.db, env.DATABASE_URL);
          return handle;
        }
        catch (error) {
          await handle.dispose();
          throw error;
        }
      })()),
    initSchoolApplication: (db, extras) =>
      buildSchoolApplication(db, {
        databaseUrl: env.DATABASE_URL,
        env,
        identityDirectory: extras.identityClient.directory,
        notifyRuntime: extras.notifyRuntime,
        runMigrations: false,
      }),
  });
  if (localScheduler) {
    runtime.legacyCronDispatcher = createInlineCronJobDispatcher;
    runtime.inlineScheduler = true;
    runtime.runSchedulerTick = work => localOperations(env).background(["PAUSE_SCHEDULER", "PAUSE_JOBS"], work);
    runtime.scheduler = new SqliteScheduler(localScheduler.binding);
    runtime.sendSchedulerMessage = msg => consumeScheduler(runtime, msg);
  }
  return {
    ...runtime,
    async close() {
      try {
        await runtime.close();
      }
      finally {
        localScheduler?.close();
      }
    },
  };
}
