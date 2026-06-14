import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { createAuth } from "@/runtime/shared/create-auth";
import type { Environment } from "@/runtime/env/schema";
import type { ApiRuntime, DatabaseHandle } from "@/runtime/types";

export interface CreateApiRuntimeOptions {
  env: Environment;
  schoolHandle: DatabaseHandle;
  authHandle: DatabaseHandle;
  initSchoolApplication: (db: PostgresTransactionalDb) => Promise<ApiSchoolApplication>;
}

export async function createApiRuntime(options: CreateApiRuntimeOptions): Promise<ApiRuntime> {
  let schoolApp: ApiSchoolApplication | null = null;
  const auth = createAuth(options.authHandle.db, options.env);

  return {
    env: options.env,
    db: options.schoolHandle.db,
    authDb: options.authHandle.db,
    sqlClient: options.schoolHandle.sqlClient,
    async getSchoolApplication() {
      if (!schoolApp) {
        schoolApp = await options.initSchoolApplication(options.schoolHandle.db as PostgresTransactionalDb);
      }
      return schoolApp;
    },
    getAuth() {
      return auth;
    },
    close: async () => {
      await Promise.all([
        options.schoolHandle.dispose(),
        options.authHandle.dispose(),
      ]);
    },
  };
}
