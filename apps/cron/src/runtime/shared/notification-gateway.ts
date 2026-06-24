import type { Logger } from "pino";
import type {
  NotificationEnqueueInput,
  NotificationGatewayPort,
  NotificationRecipient,
  NotificationRecipientProfile,
} from "@edaya/core";

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
  };
}
