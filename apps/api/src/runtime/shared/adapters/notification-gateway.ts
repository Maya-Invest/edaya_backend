import { createNotifyNotificationGateway } from "@edaya/adaptor-notify";
import type { NotifyRuntime } from "@edaya/adaptor-notify";
import type { LoggerPort, NotificationGatewayPort } from "@edaya/core";
import { noOpNotificationGateway } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";

export function isNotifyConfigured(env: Environment | undefined): boolean {
  return Boolean(env && (env.RUNTIME === "local" || env.RUNTIME === "worker"));
}

export function resolveNotificationGateway(
  env: Environment | undefined,
  logger?: LoggerPort,
  options: { runtime?: NotifyRuntime } = {},
): NotificationGatewayPort {
  if (!env || env.RUNTIME === "in-memory")
    return noOpNotificationGateway;
  if (!options.runtime)
    throw new Error("The school notification dispatcher must be initialized");
  return createNotifyNotificationGateway({
    runtime: options.runtime,
    onError: (error, context) => {
      logger?.error({ err: error, ...context }, "notification dispatch failed");
    },
  });
}
