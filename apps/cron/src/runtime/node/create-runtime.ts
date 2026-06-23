import { createCronRuntime } from "@/runtime/shared/create-cron-runtime";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createDatabase } from "@/runtime/node/database";
import type { Environment } from "@/runtime/env/schema";
import type { CronRuntime } from "@/runtime/types";

export async function buildNodeCronRuntime(env: Environment): Promise<CronRuntime> {
  const schoolHandle = await createDatabase(env);
  return createCronRuntime({
    env,
    resolveSchoolHandle: async () => schoolHandle,
    initSchoolApplication: db => buildSchoolApplication(db, { databaseUrl: env.DATABASE_URL, env }),
  });
}
