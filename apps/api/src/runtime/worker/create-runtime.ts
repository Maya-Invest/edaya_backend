import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createAuthDatabase } from "@/runtime/worker/auth-database";
import { createDatabase } from "@/runtime/worker/database";
import type { Environment } from "@/runtime/env/schema";
import type { ApiRuntime, DatabaseHandle } from "@/runtime/types";

export async function buildWorkerApiRuntime(env: Environment): Promise<ApiRuntime> {
  const authHandle = await createAuthDatabase(env);
  let schoolHandlePromise: Promise<DatabaseHandle> | null = null;

  return createApiRuntime({
    env,
    authHandle,
    resolveSchoolHandle: async () => {
      schoolHandlePromise ??= createDatabase(env);
      return schoolHandlePromise;
    },
    initSchoolApplication: db => buildSchoolApplication(db, { env }),
  });
}
