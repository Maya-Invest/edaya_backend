import { createCronRuntime } from "@/runtime/shared/create-cron-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { runMigrationsOnStartup } from "@/runtime/local/profile";
import { createSchoolDatabase } from "@/runtime/local/school-database";
import type { Environment } from "@/runtime/shared/env/schema";
import type { CronRuntime } from "@/runtime/types";

export async function buildLocalCronRuntime(env: Environment): Promise<CronRuntime> {
  if (env.RUNTIME !== "local") {
    throw new Error("buildLocalCronRuntime() requires RUNTIME=local.");
  }

  const runMigrations = runMigrationsOnStartup(env);
  let schoolHandlePromise: ReturnType<typeof createSchoolDatabase> | null = null;

  return createCronRuntime({
    env,
    resolveSchoolHandle: async () => {
      schoolHandlePromise ??= createSchoolDatabase(env);
      return schoolHandlePromise;
    },
    initSchoolApplication: db => buildSchoolApplication(db, {
      databaseUrl: env.DATABASE_URL,
      env,
      runMigrations,
    }),
  });
}
