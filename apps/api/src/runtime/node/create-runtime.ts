import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createAuthDatabase } from "@/runtime/node/auth-database";
import { createDatabase } from "@/runtime/node/database";
import type { Environment } from "@/runtime/env/schema";
import type { ApiRuntime } from "@/runtime/types";

/** Use {@link getApiRuntime} so callers share the cached runtime. */
export async function buildNodeApiRuntime(env: Environment): Promise<ApiRuntime> {
  const [schoolHandle, authHandle] = await Promise.all([
    createDatabase(env),
    createAuthDatabase(env),
  ]);

  return createApiRuntime({
    env,
    authHandle,
    resolveSchoolHandle: async () => schoolHandle,
    initSchoolApplication: db => buildSchoolApplication(db, { databaseUrl: env.DATABASE_URL }),
  });
}
