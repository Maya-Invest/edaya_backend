import { ImportFormatAdapter } from "@edaya/adaptor-import-format";
import type { NotifyRuntime } from "@edaya/adaptor-notify";
import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import type { FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort } from "@edaya/core";
import type { DirectoryClient } from "../../identity/server/index";
import type { Environment } from "@/runtime/shared/env/schema";
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresDurableWork, PostgresImportStore, PostgresSchoolRepositories, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import type { SQL } from "drizzle-orm";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { createAuthContactResolver } from "@/runtime/shared/adapters/auth-contact-resolver";
import { resolveDocumentRenderer } from "@/runtime/shared/adapters/document-renderer";
import { resolveFileStorage } from "@/runtime/shared/adapters/file-storage";
import { resolveInvitationDelivery } from "@/runtime/shared/adapters/invitation-delivery";
import { resolveNotificationGateway } from "@/runtime/shared/adapters/notification-gateway";
import { createAppLogger } from "@/runtime/shared/adapters/pino-logger";
import { resolveAccountInvitationsEnabled, resolveInviteBaseUrl, resolveProfilePhotoMaxBytes } from "@/runtime/shared/env/derived";

export interface BuildSchoolApplicationOptions {
  databaseUrl?: string;
  env?: Environment;
  notificationGateway?: NotificationGatewayPort;
  fileStorage?: FileStoragePort;
  invitationDelivery?: InvitationDeliveryPort;
  notifyRuntime?: NotifyRuntime;
  identityDirectory?: DirectoryClient;
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
    importPersistence: new PostgresImportStore(),
    importFormat: new ImportFormatAdapter(),
    commandJournal: new PostgresCommandJournal(),
    durableWork: new PostgresDurableWork(db as PostgresTransactionalDb & { execute: (query: SQL) => Promise<unknown> }),
    documentRenderer: resolveDocumentRenderer(options.env, logger),
    notificationGateway,
    fileStorage,
    invitationDelivery,
    inviteBaseUrl: resolveInviteBaseUrl(options.env),
    accountInvitationsEnabled: resolveAccountInvitationsEnabled(options.env),
    profilePhotoMaxBytes: resolveProfilePhotoMaxBytes(options.env),
    authContactResolver: options.identityDirectory
      ? createAuthContactResolver(options.identityDirectory)
      : undefined,
    repositories: repos,

  });
}
