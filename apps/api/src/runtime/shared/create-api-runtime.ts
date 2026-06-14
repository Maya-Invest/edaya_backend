import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { createAuth } from "@/runtime/shared/create-auth";
import type { Environment } from "@/runtime/env/schema";
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
  const auth = createAuth(options.authHandle.db, options.env);

  async function getResolvedSchoolHandle(): Promise<DatabaseHandle> {
    resolvedSchoolHandle ??= await options.resolveSchoolHandle();
    return resolvedSchoolHandle;
  }

  return {
    env: options.env,
    get db() {
      return resolvedSchoolHandle?.db ?? null;
    },
    authDb: options.authHandle.db,
    get sqlClient() {
      return resolvedSchoolHandle?.sqlClient ?? null;
    },
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
