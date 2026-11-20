import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createSchoolDatabase } from "@/runtime/worker/school-database";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime, DatabaseHandle } from "@/runtime/types";

export async function buildWorkerApiRuntime(env: Environment): Promise<ApiRuntime> {
  let schoolHandlePromise: Promise<DatabaseHandle> | null = null;

  return createApiRuntime({
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
}
