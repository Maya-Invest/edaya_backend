import type { Environment } from "@/lib/bootstrap/env";
import { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";
import { isEphemeralDatabase } from "@/lib/seed";
import { runMigrations as runAuthMigrations } from "@edaya/adaptor-betterauth";
import { PostgresAtomicExecution, PostgresSchoolRepositories, type PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import { createRepositoryAuthorizationPolicy } from "@edaya/core";
import { createAuth } from "@/lib/runtime/create-auth";
import { createDatabase } from "@/lib/runtime/database";
import { resolveMigrationDriver } from "@/lib/runtime/migration-driver";
import type { ApiRuntime } from "@/lib/runtime/types";

async function buildSchoolApplication(db: PostgresTransactionalDb, databaseUrl: string): Promise<ApiSchoolApplication> {
  const repos = new PostgresSchoolRepositories(db);
  await repos.init({
    driver: isEphemeralDatabase(databaseUrl) ? "pglite" : "postgres-js",
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
export async function buildApiRuntime(env: Environment): Promise<ApiRuntime> {
  const { db, sqlClient, dispose } = await createDatabase(env);
  await runAuthMigrations(db, { driver: resolveMigrationDriver(env.DATABASE_URL) });
  let schoolApp: ApiSchoolApplication | null = null;
  const auth = createAuth(db, env);

  return {
    env,
    db,
    sqlClient,
    async getSchoolApplication() {
      if (!schoolApp) {
        schoolApp = await buildSchoolApplication(db as PostgresTransactionalDb, env.DATABASE_URL);
      }
      return schoolApp;
    },
    getAuth() {
      return auth;
    },
    close: dispose,
  };
}
