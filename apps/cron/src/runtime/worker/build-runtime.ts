import { createCronRuntime } from "@/runtime/shared/create-cron-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createSchoolDatabase } from "@/runtime/worker/school-database";
import type { Environment } from "@/runtime/shared/env/schema";
import type { CronRuntime } from "@/runtime/types";

export async function buildWorkerCronRuntime(env: Environment): Promise<CronRuntime> {
  if (env.RUNTIME !== "worker") {
    throw new Error("buildWorkerCronRuntime() requires RUNTIME=worker.");
  }

  let schoolHandlePromise: ReturnType<typeof createSchoolDatabase> | null = null;

  return createCronRuntime({
    env,
    resolveSchoolHandle: async () => {
      schoolHandlePromise ??= createSchoolDatabase(env);
      return schoolHandlePromise;
    },
    initSchoolApplication: db => buildSchoolApplication(db, { env }),
  });
}
