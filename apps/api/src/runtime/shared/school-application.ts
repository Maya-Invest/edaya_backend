import type { NotifyRuntime } from "@edaya/adaptor-notify";
import { PostgresAtomicExecution, PostgresSchoolRepositories, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { apiAuthCacheInvalidationPort } from "@/lib/authorization/auth-cache-invalidation-port";
import { createAppLogger } from "@/runtime/shared/adapters/pino-logger";
import { createAuthContactResolver } from "@/runtime/shared/adapters/auth-contact-resolver";
import { resolveFileStorage } from "@/runtime/shared/adapters/file-storage";
import { resolveInvitationDelivery } from "@/runtime/shared/adapters/invitation-delivery";
import { resolveNotificationGateway } from "@/runtime/shared/adapters/notification-gateway";
import { resolveAccountInvitationsEnabled, resolveInviteBaseUrl } from "@/runtime/shared/env/derived";
import type { Environment } from "@/runtime/shared/env/schema";
import { createRepositoryAuthorizationPolicy } from "@edaya/authorization";
import type { FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort } from "@edaya/core";

export interface BuildSchoolApplicationOptions {
  databaseUrl?: string;
  env?: Environment;
  notificationGateway?: NotificationGatewayPort;
  fileStorage?: FileStoragePort;
  invitationDelivery?: InvitationDeliveryPort;
  notifyRuntime?: NotifyRuntime;
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
    ?? resolveNotificationGateway(options.env, logger, { runtime: options.notifyRuntime });
  const fileStorage = options.fileStorage
    ?? resolveFileStorage(options.env, logger);
  const invitationDelivery = options.invitationDelivery
    ?? resolveInvitationDelivery(options.env, { runtime: options.notifyRuntime });

  return new ApiSchoolApplication({
    atomicExecution,
    notificationGateway,
    fileStorage,
    invitationDelivery,
    authCacheInvalidation: apiAuthCacheInvalidationPort,
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
