import { PostgresAtomicExecution, PostgresSchoolRepositories, type PostgresTransactionalDb, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { createAppLogger } from "@/logging/app-logger";
import { resolveNotificationGateway } from "@/runtime/shared/resolve-notification-gateway";
import { createRepositoryAuthorizationPolicy, type NotificationGatewayPort } from "@edaya/core";
import type { Environment } from "@/runtime/env/schema";

export interface BuildSchoolApplicationOptions {
  databaseUrl?: string;
  env?: Environment;
  notificationGateway?: NotificationGatewayPort;
  runMigrations?: boolean;
}

export async function buildSchoolApplication(
  db: PostgresTransactionalDb,
  options: BuildSchoolApplicationOptions = {},
): Promise<ApiSchoolApplication> {
  const repos = new PostgresSchoolRepositories(db);
  if (options.runMigrations) {
    if (!options.databaseUrl) {
      throw new Error("databaseUrl is required when running school migrations on startup.");
    }

    await repos.init({
      driver: resolveMigrationDriver(options.databaseUrl),
    });
  }

  const atomicExecution = new PostgresAtomicExecution(db);
  const logger = options.env && options.env.LOG_LEVEL !== "silent"
    ? createAppLogger(options.env)
    : undefined;
  const notificationGateway = options.notificationGateway
    ?? resolveNotificationGateway(options.env, logger);

  return new ApiSchoolApplication({
    atomicExecution,
    notificationGateway,
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
