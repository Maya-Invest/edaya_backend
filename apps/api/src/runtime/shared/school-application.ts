import { PostgresAtomicExecution, PostgresSchoolRepositories, type PostgresTransactionalDb, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { createRepositoryAuthorizationPolicy } from "@edaya/core";

export interface BuildSchoolApplicationOptions {
  databaseUrl?: string;
}

export async function buildSchoolApplication(
  db: PostgresTransactionalDb,
  options: BuildSchoolApplicationOptions = {},
): Promise<ApiSchoolApplication> {
  const repos = new PostgresSchoolRepositories(db);
  if (options.databaseUrl) {
    await repos.init({
      driver: resolveMigrationDriver(options.databaseUrl),
    });
  }

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
