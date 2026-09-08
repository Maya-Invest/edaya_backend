import { createNovuNotificationGatewayFromSecretKey } from "@edaya/adaptor-novu";
import { createNotifyNotificationGateway, type NotifyRuntime } from "@edaya/adaptor-notify";
import type { LoggerPort, NotificationEnqueueInput, NotificationGatewayPort, NotificationRecipient, NotificationRecipientProfile, RegisterPushDeviceInput, UnregisterPushDeviceInput } from "@edaya/core";
import { noOpNotificationGateway } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";

export function isNotifyConfigured(env: Environment | undefined): boolean {
  if (!env || env.RUNTIME === "in-memory") {
    return false;
  }
  if (env.NOVU_SECRET_KEY?.trim()) {
    return false;
  }
  return env.RUNTIME === "local" || env.RUNTIME === "worker";
}

export function createLoggingNotificationGateway(logger: LoggerPort): NotificationGatewayPort {
  const notificationLogger = logger.child({ module: "notifications" });

  return {
    enqueue: async (input: NotificationEnqueueInput) => {
      notificationLogger.info({ notification: input }, "notification enqueued");
    },
    cancel: async (idempotencyKey: string) => {
      notificationLogger.info({ idempotencyKey }, "notification cancelled");
    },
    upsertRecipient: async (profile: NotificationRecipientProfile) => {
      notificationLogger.info({ profile }, "notification recipient upserted");
    },
    removeRecipient: async (schoolId: string, recipient: NotificationRecipient) => {
      notificationLogger.info({ schoolId, recipient }, "notification recipient removed");
    },
    registerPushDevice: async (input: RegisterPushDeviceInput) => {
      notificationLogger.info({ input }, "push device registered");
    },
    unregisterPushDevice: async (input: UnregisterPushDeviceInput) => {
      notificationLogger.info({ input }, "push device unregistered");
    },
  };
}

export function resolveNotificationGateway(
  env: Environment | undefined,
  logger?: LoggerPort,
  options: { runtime?: NotifyRuntime } = {},
): NotificationGatewayPort {
  if (!env || env.LOG_LEVEL === "silent" || env.RUNTIME === "in-memory") {
    return noOpNotificationGateway;
  }

  if (isNotifyConfigured(env) && options.runtime) {
    return createNotifyNotificationGateway({
      runtime: options.runtime,
      onError: (error, context) => {
        logger?.error({ err: error, ...context }, "notify notification failed");
      },
    });
  }

  if (env.NOVU_SECRET_KEY) {
    return createNovuNotificationGatewayFromSecretKey({
      secretKey: env.NOVU_SECRET_KEY,
      serverURL: env.NOVU_API_URL,
      onError: (error, context) => {
        logger?.error({ err: error, ...context }, "novu notification failed");
      },
    });
  }

  if (!logger) {
    return noOpNotificationGateway;
  }

  return createLoggingNotificationGateway(logger);
}
