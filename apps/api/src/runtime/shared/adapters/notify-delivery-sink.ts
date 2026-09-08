import { MessageDeliveryStatus, type NormalizedDeliveryEvent } from "@edaya/core";
import { createSystemActorMetadata } from "@edaya/authorization";
import type { ApiSchoolApplication } from "@/lib/school-api/application";

const DELIVERY_STATUS_BY_EVENT = {
  sent: MessageDeliveryStatus.Sent,
  failed: MessageDeliveryStatus.Failed,
  read: MessageDeliveryStatus.Read,
  cancelled: MessageDeliveryStatus.Cancelled,
} as const;

export async function applyInProcessNotifyDeliveryEvent(
  app: ApiSchoolApplication,
  event: NormalizedDeliveryEvent,
): Promise<void> {
  const delivery = await app.repositories.messageDeliveries.findById(event.deliveryId);
  if (!delivery) {
    return;
  }
  if (event.subjectId && event.subjectId !== delivery.subjectId) {
    return;
  }

  const actor = createSystemActorMetadata({
    systemId: "notify-adapter",
    schoolId: delivery.schoolId,
    requestId: `notify:${event.deliveryId}`,
    reason: "in-process notification delivery",
  });
  await app.forActor(actor).communicationsWorkflow.applyDeliveryEvent({
    deliveryId: event.deliveryId,
    status: DELIVERY_STATUS_BY_EVENT[event.status],
    providerMessageId: event.providerMessageId,
    failureReason: event.failureReason,
    occurredAt: event.occurredAt,
  });
}
