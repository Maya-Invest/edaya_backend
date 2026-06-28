import type {
  NotificationDeliveryStatusLookup,
  NotificationEnqueueInput,
  NotificationGatewayPort,
  NotificationRecipient,
  NotificationRecipientProfile,
  RegisterPushDeviceInput,
  UnregisterPushDeviceInput,
} from "@edaya/core";
import { chunkNovuTriggerRequests, defaultNovuWorkflowIdResolver, mapNotificationToNovuTriggerRequest } from "./trigger-request";
import type { NovuMessagesClient } from "./novu-messages-client";
import type { NovuNotificationGatewayOptions } from "./types";

export interface NovuSubscriberClient {
  upsert: (subscriberId: string, schoolId: string, profile: NotificationRecipientProfile) => Promise<void>;
  remove: (subscriberId: string) => Promise<void>;
  registerPushDevice: (subscriberId: string, provider: "fcm" | "apns", token: string) => Promise<void>;
  unregisterPushDevice: (subscriberId: string, provider: "fcm" | "apns") => Promise<void>;
}

export interface ExtendedNovuNotificationGatewayOptions extends NovuNotificationGatewayOptions {
  subscriberClient?: NovuSubscriberClient;
  messagesClient?: NovuMessagesClient;
}

export function createNovuNotificationGateway(
  options: ExtendedNovuNotificationGatewayOptions,
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

  async function safeUpsertRecipient(profile: NotificationRecipientProfile): Promise<void> {
    if (!options.subscriberClient || !profile.recipient.subjectId) {
      return;
    }
    try {
      await options.subscriberClient.upsert(
        profile.recipient.subjectId,
        profile.schoolId,
        profile,
      );
    }
    catch (error) {
      options.onError?.(error, { operation: "upsertRecipient", profile });
    }
  }

  async function safeRemoveRecipient(schoolId: string, recipient: NotificationRecipient): Promise<void> {
    if (!options.subscriberClient || !recipient.subjectId) {
      return;
    }
    try {
      await options.subscriberClient.remove(recipient.subjectId);
    }
    catch (error) {
      options.onError?.(error, { operation: "removeRecipient", schoolId, recipient });
    }
  }

  async function safeLookupDeliveryStatuses(
    deliveries: ReadonlyArray<{ deliveryId: string; subjectId: string }>,
  ): Promise<ReadonlyMap<string, NotificationDeliveryStatusLookup>> {
    if (!options.messagesClient || deliveries.length === 0) {
      return new Map();
    }
    try {
      return await options.messagesClient.lookupDeliveryStatuses(deliveries);
    }
    catch (error) {
      options.onError?.(error, { operation: "lookupDeliveryStatuses", deliveries });
      return new Map();
    }
  }

  async function safeRegisterPushDevice(input: RegisterPushDeviceInput): Promise<void> {
    if (!options.subscriberClient) {
      return;
    }
    try {
      await options.subscriberClient.registerPushDevice(
        input.subjectId,
        input.provider,
        input.token,
      );
    }
    catch (error) {
      options.onError?.(error, { operation: "registerPushDevice", input });
      throw error;
    }
  }

  async function safeUnregisterPushDevice(input: UnregisterPushDeviceInput): Promise<void> {
    if (!options.subscriberClient) {
      return;
    }
    try {
      await options.subscriberClient.unregisterPushDevice(input.subjectId, input.provider);
    }
    catch (error) {
      options.onError?.(error, { operation: "unregisterPushDevice", input });
    }
  }

  return {
    enqueue: safeEnqueue,
    cancel: safeCancel,
    upsertRecipient: safeUpsertRecipient,
    removeRecipient: safeRemoveRecipient,
    ...(options.subscriberClient
      ? {
          registerPushDevice: safeRegisterPushDevice,
          unregisterPushDevice: safeUnregisterPushDevice,
        }
      : {}),
    ...(options.messagesClient
      ? { lookupDeliveryStatuses: safeLookupDeliveryStatuses }
      : {}),
  };
}
