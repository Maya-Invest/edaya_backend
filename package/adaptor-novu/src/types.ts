import type { NotificationEnqueueInput, RegisterPushDeviceInput, UnregisterPushDeviceInput } from "@edaya/core";
import type { NovuTriggerSubscriber } from "./trigger-recipient";

export type NovuTriggerTo =
  | string
  | string[]
  | NovuTriggerSubscriber
  | NovuTriggerSubscriber[];

export interface NovuTriggerRequest {
  workflowId: string;
  to: NovuTriggerTo;
  payload: Record<string, unknown>;
  transactionId: string;
  /** Novu v2 tenant scope — maps schoolId to `context.tenant` on trigger. */
  context?: {
    tenant: string;
  };
}

export interface NovuTriggerClient {
  trigger: (request: NovuTriggerRequest) => Promise<void>;
  triggerBulk: (requests: NovuTriggerRequest[]) => Promise<void>;
  cancel: (transactionId: string) => Promise<void>;
}

export type NovuWorkflowIdResolver = (input: NotificationEnqueueInput) => string;

export interface NovuNotificationGatewayOptions {
  client: NovuTriggerClient;
  resolveWorkflowId?: NovuWorkflowIdResolver;
  onError?: (error: unknown, context: {
    operation: "enqueue" | "cancel" | "upsertRecipient" | "removeRecipient" | "lookupDeliveryStatuses" | "registerPushDevice" | "unregisterPushDevice";
    input?: NotificationEnqueueInput | RegisterPushDeviceInput | UnregisterPushDeviceInput;
    idempotencyKey?: string;
    profile?: import("@edaya/core").NotificationRecipientProfile;
    schoolId?: string;
    recipient?: import("@edaya/core").NotificationRecipient;
    deliveries?: ReadonlyArray<{ deliveryId: string; subjectId: string }>;
  }) => void;
}
