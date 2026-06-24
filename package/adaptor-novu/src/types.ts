import type { NotificationEnqueueInput } from "@edaya/core";

export interface NovuTriggerRequest {
  workflowId: string;
  to: string | string[];
  payload: Record<string, unknown>;
  transactionId: string;
  tenant: string;
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
    operation: "enqueue" | "cancel" | "upsertRecipient" | "removeRecipient" | "lookupDeliveryStatuses";
    input?: NotificationEnqueueInput;
    idempotencyKey?: string;
    profile?: import("@edaya/core").NotificationRecipientProfile;
    schoolId?: string;
    recipient?: import("@edaya/core").NotificationRecipient;
    deliveries?: ReadonlyArray<{ deliveryId: string; subjectId: string }>;
  }) => void;
}
