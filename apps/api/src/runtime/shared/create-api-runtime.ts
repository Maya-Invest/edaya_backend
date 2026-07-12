import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { createBetterAuth } from "@/runtime/shared/adapters/better-auth";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime, DatabaseHandle } from "@/runtime/types";

export interface CreateApiRuntimeOptions {
  env: Environment;
  authHandle: DatabaseHandle;
  resolveSchoolHandle: () => Promise<DatabaseHandle>;
  initSchoolApplication: (db: PostgresTransactionalDb) => Promise<ApiSchoolApplication>;
}

export async function createApiRuntime(options: CreateApiRuntimeOptions): Promise<ApiRuntime> {
  let schoolApp: ApiSchoolApplication | null = null;
  let resolvedSchoolHandle: DatabaseHandle | null = null;
  const auth = createBetterAuth(options.authHandle.db, options.env, {
    ...(options.env.authSecondaryStorage
      ? { secondaryStorage: options.env.authSecondaryStorage }
      : {}),
  });

  async function getResolvedSchoolHandle(): Promise<DatabaseHandle> {
    resolvedSchoolHandle ??= await options.resolveSchoolHandle();
    return resolvedSchoolHandle;
  }

  return {
    env: options.env,
    async getSchoolApplication() {
      if (!schoolApp) {
        const handle = await getResolvedSchoolHandle();
        schoolApp = await options.initSchoolApplication(handle.db as PostgresTransactionalDb);
      }
      return schoolApp;
    },
    getAuth() {
      return auth;
    },
    close: async () => {
      await options.authHandle.dispose();
      if (resolvedSchoolHandle) {
        await resolvedSchoolHandle.dispose();
      }
    },
  };
}
