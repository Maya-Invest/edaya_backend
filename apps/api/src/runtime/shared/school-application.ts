import { PostgresAtomicExecution, PostgresSchoolRepositories, type PostgresTransactionalDb, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import { createNovuInvitationDeliveryPortFromSecretKey } from "@edaya/adaptor-novu";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { createAppLogger } from "@/logging/app-logger";
import { resolveNotificationGateway } from "@/runtime/shared/resolve-notification-gateway";
import { resolveAccountInvitationsEnabled, resolveInviteBaseUrl } from "@/runtime/shared/resolve-invite-config";
import { createRepositoryAuthorizationPolicy, type InvitationDeliveryPort, noOpInvitationDeliveryPort, type NotificationGatewayPort } from "@edaya/core";
import type { Environment } from "@/runtime/env/schema";
import { createAuthContactResolver } from "@/runtime/shared/auth-contact-resolver";

export interface BuildSchoolApplicationOptions {
  databaseUrl?: string;
  env?: Environment;
  notificationGateway?: NotificationGatewayPort;
  invitationDelivery?: InvitationDeliveryPort;
  authDb?: unknown;
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
  const invitationDelivery = options.invitationDelivery
    ?? (options.env?.NOVU_SECRET_KEY
      ? createNovuInvitationDeliveryPortFromSecretKey({
          secretKey: options.env.NOVU_SECRET_KEY,
          serverURL: options.env.NOVU_API_URL,
        })
      : noOpInvitationDeliveryPort);

  return new ApiSchoolApplication({
    atomicExecution,
    notificationGateway,
    invitationDelivery,
    inviteBaseUrl: resolveInviteBaseUrl(options.env),
    accountInvitationsEnabled: resolveAccountInvitationsEnabled(options.env),
    authContactResolver: options.authDb
      ? createAuthContactResolver(options.authDb as Parameters<typeof createAuthContactResolver>[0])
      : undefined,
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
