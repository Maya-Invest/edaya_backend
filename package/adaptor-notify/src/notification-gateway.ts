import type {
  NotificationEnqueueInput,
  NotificationGatewayPort,
  NotificationRecipient,
  NotificationRecipientProfile,
  RegisterPushDeviceInput,
  UnregisterPushDeviceInput,
} from "@edaya/core";
import {
  cancelSchoolNotification,
  enqueueSchoolNotification,
  lookupSchoolDeliveryStatuses,
  registerSchoolPushDevice,
  removeSchoolRecipient,
  unregisterSchoolPushDevice,
  upsertSchoolRecipient,
} from "./operations";
import type { NotifyRuntime } from "./runtime";

export interface CreateNotifyNotificationGatewayOptions {
  runtime: NotifyRuntime;
  onError?: (error: unknown, context: Record<string, unknown>) => void;
}

export function createNotifyNotificationGateway(
  options: CreateNotifyNotificationGatewayOptions,
): NotificationGatewayPort {
  const { runtime, onError } = options;

  return {
    enqueue: async (input: NotificationEnqueueInput) => {
      try {
        await enqueueSchoolNotification(runtime, input);
      }
      catch (error) {
        onError?.(error, { operation: "enqueue", input });
      }
    },
    cancel: async (idempotencyKey) => {
      try {
        await cancelSchoolNotification(runtime, idempotencyKey);
      }
      catch (error) {
        onError?.(error, { operation: "cancel", idempotencyKey });
      }
    },
    upsertRecipient: async (profile: NotificationRecipientProfile) => {
      try {
        await upsertSchoolRecipient(runtime, profile);
      }
      catch (error) {
        onError?.(error, { operation: "upsertRecipient", profile });
      }
    },
    removeRecipient: async (schoolId: string, recipient: NotificationRecipient) => {
      try {
        await removeSchoolRecipient(runtime, schoolId, recipient);
      }
      catch (error) {
        onError?.(error, { operation: "removeRecipient", schoolId, recipient });
      }
    },
    lookupDeliveryStatuses: async (deliveries) => {
      try {
        return await lookupSchoolDeliveryStatuses(runtime, deliveries);
      }
      catch (error) {
        onError?.(error, { operation: "lookupDeliveryStatuses", deliveries });
        return new Map();
      }
    },
    registerPushDevice: async (input: RegisterPushDeviceInput) => {
      try {
        await registerSchoolPushDevice(runtime, input);
      }
      catch (error) {
        onError?.(error, { operation: "registerPushDevice", input });
        throw error;
      }
    },
    unregisterPushDevice: async (input: UnregisterPushDeviceInput) => {
      try {
        await unregisterSchoolPushDevice(runtime, input);
      }
      catch (error) {
        onError?.(error, { operation: "unregisterPushDevice", input });
      }
    },
  };
}
