import type { SchoolApplication } from "@edaya/core";
import type { CronRuntime, DatabaseHandle } from "@/runtime/types";
import type { Environment } from "@/runtime/shared/env/schema";

export interface CreateCronRuntimeOptions {
  env: Environment;
  resolveSchoolHandle: () => Promise<DatabaseHandle>;
  initSchoolApplication: (db: import("@edaya/adaptor-postgres").PostgresTransactionalDb) => Promise<SchoolApplication>;
}

export async function createCronRuntime(options: CreateCronRuntimeOptions): Promise<CronRuntime> {
  let schoolApp: SchoolApplication | null = null;
  let resolvedSchoolHandle: DatabaseHandle | null = null;

  async function getResolvedSchoolHandle(): Promise<DatabaseHandle> {
    resolvedSchoolHandle ??= await options.resolveSchoolHandle();
    return resolvedSchoolHandle;
  }

  return {
    env: options.env,
    async getSchoolApplication() {
      if (!schoolApp) {
        const handle = await getResolvedSchoolHandle();
        schoolApp = await options.initSchoolApplication(handle.db as import("@edaya/adaptor-postgres").PostgresTransactionalDb);
      }
      return schoolApp;
    },
    close: async () => {
      if (resolvedSchoolHandle) {
        await resolvedSchoolHandle.dispose();
      }
    },
  };
}
