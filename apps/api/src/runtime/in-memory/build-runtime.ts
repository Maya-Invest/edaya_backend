import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createAuthDatabase } from "@/runtime/in-memory/auth-database";
import { createPgliteSchoolDatabase } from "@/runtime/shared/school-database";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";

export async function buildInMemoryApiRuntime(env: Environment): Promise<ApiRuntime> {
  if (env.RUNTIME !== "in-memory") {
    throw new Error("buildInMemoryApiRuntime() requires RUNTIME=in-memory.");
  }

  const runMigrations = true;
  const [schoolHandle, authHandle] = await Promise.all([
    createPgliteSchoolDatabase(null),
    createAuthDatabase({ runMigrations }),
  ]);

  return createApiRuntime({
    env,
    authHandle,
    resolveSchoolHandle: async () => schoolHandle,
    initSchoolApplication: db => buildSchoolApplication(db, {
      databaseUrl: env.DATABASE_URL,
      env,
      authDb: authHandle.db,
      runMigrations,
    }),
  });
}
