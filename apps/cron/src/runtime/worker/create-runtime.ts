import { createCronRuntime } from "@/runtime/shared/create-cron-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createDatabase } from "@/runtime/worker/database";
import type { Environment } from "@/runtime/env/schema";
import type { CronRuntime } from "@/runtime/types";

export async function buildWorkerCronRuntime(env: Environment): Promise<CronRuntime> {
  let schoolHandlePromise: ReturnType<typeof createDatabase> | null = null;
  return createCronRuntime({
    env,
    resolveSchoolHandle: async () => {
      schoolHandlePromise ??= createDatabase(env);
      return schoolHandlePromise;
    },
    initSchoolApplication: db => buildSchoolApplication(db, { env }),
  });
}
