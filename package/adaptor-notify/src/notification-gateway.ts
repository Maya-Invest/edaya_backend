import type {
  NotificationEnqueueInput,
  NotificationGatewayPort,
  RegisterPushDeviceInput,
  UnregisterPushDeviceInput,
} from "@edaya/core";
import type { NotifyRuntime } from "./runtime";
import {
  cancelSchoolNotification,
  enqueueSchoolNotification,
  lookupSchoolDeliveryStatuses,
  registerSchoolPushDevice,
  unregisterSchoolPushDevice,
} from "./operations";

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
        onError?.(error, { operation: "enqueue", idempotencyKey: input.idempotencyKey });
        throw error;
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
