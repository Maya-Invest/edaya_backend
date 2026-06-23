import type { NotificationGatewayPort } from "@edaya/core";
import { createNovuNotificationGateway } from "./novu-notification-gateway";
import { createNovuSdkClient } from "./novu-sdk-client";
import type { NovuNotificationGatewayOptions } from "./types";

export interface CreateNovuNotificationGatewayFromSecretKeyOptions {
  secretKey: string;
  serverURL?: string;
  resolveWorkflowId?: NovuNotificationGatewayOptions["resolveWorkflowId"];
  onError?: NovuNotificationGatewayOptions["onError"];
}

export function createNovuNotificationGatewayFromSecretKey(
  options: CreateNovuNotificationGatewayFromSecretKeyOptions,
): NotificationGatewayPort {
  return createNovuNotificationGateway({
    client: createNovuSdkClient({
      secretKey: options.secretKey,
      serverURL: options.serverURL,
    }),
    resolveWorkflowId: options.resolveWorkflowId,
    onError: options.onError,
  });
}
