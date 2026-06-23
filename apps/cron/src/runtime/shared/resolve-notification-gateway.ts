import { createNovuNotificationGatewayFromSecretKey } from "@edaya/adaptor-novu";
import type { NotificationGatewayPort } from "@edaya/core";
import { noOpNotificationGateway } from "@edaya/core";
import type { Logger } from "pino";
import { createLoggingNotificationGateway } from "@/runtime/shared/notification-gateway";
import type { Environment } from "@/runtime/env/schema";

export function resolveNotificationGateway(
  env: Environment | undefined,
  logger?: Logger,
): NotificationGatewayPort {
  if (!env || env.LOG_LEVEL === "silent") {
    return noOpNotificationGateway;
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
