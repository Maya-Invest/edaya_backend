import { PostgresAtomicExecution, PostgresSchoolRepositories, type PostgresTransactionalDb, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { createAuthDatabase } from "@/lib/runtime/create-auth-database-node";
import { createAuth } from "@/lib/runtime/create-auth";
import { createDatabase } from "@/lib/runtime/database-node";
import type { Environment } from "@/lib/runtime/env";
import type { ApiRuntime } from "@/lib/runtime/types";
import { createRepositoryAuthorizationPolicy } from "@edaya/core";

async function buildSchoolApplication(
  db: PostgresTransactionalDb,
  databaseUrl: string,
): Promise<ApiSchoolApplication> {
  const repos = new PostgresSchoolRepositories(db);
  await repos.init({
    driver: resolveMigrationDriver(databaseUrl),
  });

  const atomicExecution = new PostgresAtomicExecution(db);
  return new ApiSchoolApplication({
    atomicExecution,
    repositories: repos,
    authorizationPolicy: createRepositoryAuthorizationPolicy({
      repositories: repos,
      staffAssignmentRepository: repos.staffAssignments,
      staffMemberRepository: repos.staffMembers,
      guardianRepository: repos.guardians,
      guardianStudentLinkRepository: repos.guardianLinks,
      studentRepository: repos.students,
    }),
  });
}

/** Use {@link getApiRuntime} so callers share the cached runtime. */
export async function buildNodeApiRuntime(env: Environment): Promise<ApiRuntime> {
  const [schoolHandle, authHandle] = await Promise.all([
    createDatabase(env),
    createAuthDatabase(env),
  ]);
  let schoolApp: ApiSchoolApplication | null = null;
  const auth = createAuth(authHandle.db, env);

  return {
    env,
    db: schoolHandle.db,
    authDb: authHandle.db,
    sqlClient: schoolHandle.sqlClient,
    async getSchoolApplication() {
      if (!schoolApp) {
        schoolApp = await buildSchoolApplication(
          schoolHandle.db as PostgresTransactionalDb,
          env.DATABASE_URL,
        );
      }
      return schoolApp;
    },
    getAuth() {
      return auth;
    },
    close: async () => {
      await Promise.all([
        schoolHandle.dispose(),
        authHandle.dispose(),
      ]);
    },
  };
}
