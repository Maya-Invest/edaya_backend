import type { NotificationEnqueueInput, NotificationGatewayPort } from "@edaya/core";
import { chunkNovuTriggerRequests, defaultNovuWorkflowIdResolver, mapNotificationToNovuTriggerRequest } from "./trigger-request";
import type { NovuNotificationGatewayOptions } from "./types";

export function createNovuNotificationGateway(
  options: NovuNotificationGatewayOptions,
): NotificationGatewayPort {
  const resolveWorkflowId = options.resolveWorkflowId ?? defaultNovuWorkflowIdResolver;

  async function safeEnqueue(input: NotificationEnqueueInput): Promise<void> {
    try {
      const request = mapNotificationToNovuTriggerRequest(input, resolveWorkflowId);
      const chunks = chunkNovuTriggerRequests(request);
      if (chunks.length === 1) {
        await options.client.trigger(chunks[0]!);
        return;
      }
      await options.client.triggerBulk(chunks);
    }
    catch (error) {
      options.onError?.(error, { operation: "enqueue", input });
    }
  }

  async function safeCancel(idempotencyKey: string): Promise<void> {
    try {
      await options.client.cancel(idempotencyKey);
    }
    catch (error) {
      options.onError?.(error, { operation: "cancel", idempotencyKey });
    }
  }

  return {
    enqueue: safeEnqueue,
    cancel: safeCancel,
  };
}
