import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createAuthDatabase } from "@/runtime/worker/auth-database";
import { createDatabase } from "@/runtime/worker/database";
import type { Environment } from "@/runtime/env/schema";
import type { ApiRuntime } from "@/runtime/types";

export async function buildWorkerApiRuntime(env: Environment): Promise<ApiRuntime> {
  const [schoolHandle, authHandle] = await Promise.all([
    createDatabase(env),
    createAuthDatabase(env),
  ]);

  return createApiRuntime({
    env,
    schoolHandle,
    authHandle,
    initSchoolApplication: db => buildSchoolApplication(db),
  });
}
