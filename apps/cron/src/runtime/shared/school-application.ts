import { PostgresAtomicExecution, PostgresSchoolRepositories, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import { createRepositoryAuthorizationPolicy, SchoolApplication } from "@edaya/core";
import type { NotificationGatewayPort } from "@edaya/core";
import { createAppLogger } from "@/logging/app-logger";
import { resolveNotificationGateway } from "@/runtime/shared/resolve-notification-gateway";
import type { Environment } from "@/runtime/env/schema";

export interface BuildSchoolApplicationOptions {
  databaseUrl?: string;
  env?: Environment;
  notificationGateway?: NotificationGatewayPort;
}

export async function buildSchoolApplication(
  db: PostgresTransactionalDb,
  options: BuildSchoolApplicationOptions = {},
): Promise<SchoolApplication> {
  const repos = new PostgresSchoolRepositories(db);
  if (options.databaseUrl) {
    await repos.init({
      driver: resolveMigrationDriver(options.databaseUrl),
    });
  }

  const logger = options.env && options.env.LOG_LEVEL !== "silent"
    ? createAppLogger(options.env)
    : undefined;
  const notificationGateway = options.notificationGateway
    ?? resolveNotificationGateway(options.env, logger);

  return new SchoolApplication({
    atomicExecution: new PostgresAtomicExecution(db),
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
