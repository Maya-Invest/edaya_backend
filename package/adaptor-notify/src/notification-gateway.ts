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
      catch {
        const error = new Error("NOTIFY_STORAGE_FAILED");
        onError?.(error, { operation: "enqueue", schoolId: input.schoolId, idempotencyKey: input.idempotencyKey });
        throw error;
      }
    },
    cancel: async (idempotencyKey, schoolId) => {
      try {
        await cancelSchoolNotification(runtime, idempotencyKey, schoolId);
      }
      catch {
        const error = new Error("NOTIFY_STORAGE_FAILED");
        onError?.(error, { operation: "cancel", schoolId, idempotencyKey });
        throw error;
      }
    },
    lookupDeliveryStatuses: async (deliveries) => {
      try {
        return await lookupSchoolDeliveryStatuses(runtime, deliveries);
      }
      catch {
        const error = new Error("NOTIFY_STORAGE_FAILED");
        onError?.(error, { operation: "lookupDeliveryStatuses", count: deliveries.length });
        throw error;
      }
    },
    registerPushDevice: async (input: RegisterPushDeviceInput) => {
      try {
        await registerSchoolPushDevice(runtime, input);
      }
      catch {
        const error = new Error("NOTIFY_STORAGE_FAILED");
        onError?.(error, { operation: "registerPushDevice", schoolId: input.schoolId, subjectId: input.subjectId });
        throw error;
      }
    },
    unregisterPushDevice: async (input: UnregisterPushDeviceInput) => {
      try {
        await unregisterSchoolPushDevice(runtime, input);
      }
      catch {
        const error = new Error("NOTIFY_STORAGE_FAILED");
        onError?.(error, { operation: "unregisterPushDevice", schoolId: input.schoolId, subjectId: input.subjectId });
        throw error;
      }
    },
  };
}
