import type {
  NotificationEnqueueInput,
  NotificationGatewayPort,
  NotificationRecipient,
  NotificationRecipientProfile,
  RegisterPushDeviceInput,
  UnregisterPushDeviceInput,
} from "@edaya/core";
import type { Logger } from "pino";

export function createLoggingNotificationGateway(logger: Logger): NotificationGatewayPort {
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
