import type {
  NotificationEnqueueInput,
  NotificationGatewayPort,
  NotificationRecipient,
  NotificationRecipientProfile,
} from "@edaya/core";
import type { Logger } from "pino";
import { createLoggingNotificationGateway } from "@/runtime/shared/notification-gateway";

/**
 * Staging adapter: logs enqueue/cancel/sync intent. MessageDelivery rows are
 * materialized by communications workflows; provider dispatch is phase 6.
 */
export function createMessageDeliveryNotificationGateway(logger: Logger): NotificationGatewayPort {
  const loggingGateway = createLoggingNotificationGateway(logger);

  return {
    enqueue: async (input: NotificationEnqueueInput) => {
      await loggingGateway.enqueue(input);
    },
    cancel: async (idempotencyKey: string) => {
      await loggingGateway.cancel(idempotencyKey);
    },
    upsertRecipient: async (profile: NotificationRecipientProfile) => {
      await loggingGateway.upsertRecipient(profile);
    },
    removeRecipient: async (schoolId: string, recipient: NotificationRecipient) => {
      await loggingGateway.removeRecipient(schoolId, recipient);
    },
  };
}
