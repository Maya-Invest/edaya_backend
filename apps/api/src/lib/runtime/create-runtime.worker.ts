import { PostgresAtomicExecution, PostgresSchoolRepositories, type PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { createAuthDatabase } from "@/lib/runtime/create-auth-database.worker";
import { createAuth } from "@/lib/runtime/create-auth";
import { createDatabase } from "@/lib/runtime/database.worker";
import type { Environment } from "@/lib/runtime/env";
import type { ApiRuntime } from "@/lib/runtime/types";
import { createRepositoryAuthorizationPolicy } from "@edaya/core";

async function buildSchoolApplication(db: PostgresTransactionalDb): Promise<ApiSchoolApplication> {
  const repos = new PostgresSchoolRepositories(db);
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

export async function buildWorkerApiRuntime(env: Environment): Promise<ApiRuntime> {
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
        schoolApp = await buildSchoolApplication(schoolHandle.db as PostgresTransactionalDb);
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
