import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createAuthDatabase } from "@/runtime/in-memory/auth-database";
import { createPgliteSchoolDatabase } from "@/runtime/shared/school-database";
import { runStartupMigrations } from "@/runtime/shared/run-startup-migrations";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";

export async function buildInMemoryApiRuntime(env: Environment): Promise<ApiRuntime> {
  if (env.RUNTIME !== "in-memory") {
    throw new Error("buildInMemoryApiRuntime() requires RUNTIME=in-memory.");
  }

  const schoolHandle = await createPgliteSchoolDatabase(null);
  await runStartupMigrations(schoolHandle.db, env.DATABASE_URL);
  const authHandle = await createAuthDatabase(schoolHandle, {
    runMigrations: false,
    databaseUrl: env.DATABASE_URL,
  });

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
