import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { runMigrationsOnStartup } from "@/runtime/local/profile";
import { createAuthDatabase } from "@/runtime/local/auth-database";
import { createSchoolDatabase } from "@/runtime/local/school-database";
import { runStartupMigrations } from "@/runtime/shared/run-startup-migrations";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";

export async function buildLocalApiRuntime(env: Environment): Promise<ApiRuntime> {
  if (env.RUNTIME !== "local") {
    throw new Error("buildLocalApiRuntime() requires RUNTIME=local.");
  }

  const runMigrations = runMigrationsOnStartup(env);
  const schoolHandle = await createSchoolDatabase(env);
  if (runMigrations) {
    await runStartupMigrations(schoolHandle.db, env.DATABASE_URL);
  }
  const authHandle = await createAuthDatabase(schoolHandle, env, { runMigrations: false });

  return createApiRuntime({
    env,
    authHandle,
    resolveSchoolHandle: async () => schoolHandle,
    initSchoolApplication: db => buildSchoolApplication(db, {
      databaseUrl: env.DATABASE_URL,
      env,
      authDb: authHandle.db,
      runMigrations: false,
    }),
  });
}
