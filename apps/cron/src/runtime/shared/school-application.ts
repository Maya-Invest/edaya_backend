import { PostgresAtomicExecution, PostgresSchoolRepositories, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import { createRepositoryAuthorizationPolicy, SchoolApplication } from "@edaya/core";
import { noOpFileStorage } from "@edaya/adaptor-file";
import { createAppLogger } from "@/logging/app-logger";
import { resolveNotificationGateway } from "@/runtime/shared/adapters/notification-gateway";
import type { Environment } from "@/runtime/shared/env/schema";

export interface BuildSchoolApplicationOptions {
  databaseUrl?: string;
  env?: Environment;
  runMigrations?: boolean;
}

export async function buildSchoolApplication(
  db: PostgresTransactionalDb,
  options: BuildSchoolApplicationOptions = {},
): Promise<SchoolApplication> {
  const repos = new PostgresSchoolRepositories(db);
  if (options.runMigrations) {
    if (!options.databaseUrl) {
      throw new Error("databaseUrl is required when running school migrations on startup.");
    }

    await repos.init({
      driver: resolveMigrationDriver(options.databaseUrl),
    });
  }

  const logger = options.env && options.env.LOG_LEVEL !== "silent"
    ? createAppLogger(options.env)
    : undefined;
  const notificationGateway = resolveNotificationGateway(options.env, logger);

  return new SchoolApplication({
    atomicExecution: new PostgresAtomicExecution(db),
    notificationGateway,
    fileStorage: noOpFileStorage,
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
