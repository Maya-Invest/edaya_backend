import type {
  NotificationEnqueueInput,
  NotificationGatewayPort,
} from "@edaya/core";
import type { Logger } from "pino";
import { createLoggingNotificationGateway } from "@/runtime/shared/notification-gateway";

/**
 * Staging adapter: logs enqueue/cancel intent. MessageDelivery rows are
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
  };
}
