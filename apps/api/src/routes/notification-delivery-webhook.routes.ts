import type { AppRouteHandler } from "@/http/types";
import { resolveNotificationDeliveryWebhookAdapter } from "@/runtime/shared/resolve-notification-delivery-webhook";
import { createSystemActorMetadata, MessageDeliveryStatus } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { randomUUID } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const DELIVERY_STATUS_BY_EVENT = {
  sent: MessageDeliveryStatus.Sent,
  failed: MessageDeliveryStatus.Failed,
  read: MessageDeliveryStatus.Read,
  cancelled: MessageDeliveryStatus.Cancelled,
} as const;

const webhookResponseSchema = z.object({
  processed: z.number().int().nonnegative(),
  ignored: z.number().int().nonnegative(),
}).openapi("NotificationDeliveryWebhookResponse");

export const notificationDeliveryWebhookRoute = createRoute({
  method: "post",
  path: "/webhooks/notification-delivery",
  tags: ["Webhooks"],
  summary: "Notification delivery lifecycle webhook",
  request: {},
  responses: {
    [HttpStatusCodes.OK]: jsonContent(webhookResponseSchema, "Processed delivery events"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(createMessageObjectSchema(), "Invalid webhook signature"),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(createMessageObjectSchema(), "Webhook adapter not configured"),
  },
});

export const notificationDeliveryWebhookHandler: AppRouteHandler<typeof notificationDeliveryWebhookRoute> = async (c) => {
  const adapter = resolveNotificationDeliveryWebhookAdapter(c.env);
  if (!adapter) {
    return c.json(
      { message: "Notification delivery webhook is not configured" },
      HttpStatusCodes.SERVICE_UNAVAILABLE,
    );
  }

  const rawBody = await c.req.raw.text();
  const verified = await adapter.verifyRequest(c.req.raw, rawBody);
  if (!verified) {
    return c.json({ message: "Invalid webhook signature" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const events = await adapter.parseEvents(rawBody);
  let processed = 0;
  let ignored = 0;

  for (const event of events) {
    const delivery = await c.var.schoolApp.repositories.messageDeliveries.findById(event.deliveryId);
    if (!delivery) {
      c.var.logger.warn({ deliveryId: event.deliveryId }, "notification delivery webhook ignored unknown delivery");
      ignored += 1;
      continue;
    }

    if (event.subjectId && event.subjectId !== delivery.subjectId) {
      c.var.logger.warn({
        deliveryId: event.deliveryId,
        expectedSubjectId: delivery.subjectId,
        receivedSubjectId: event.subjectId,
      }, "notification delivery webhook subscriber mismatch");
      ignored += 1;
      continue;
    }

    const announcement = await c.var.schoolApp.repositories.announcements.findById(delivery.announcementId);
    if (!announcement) {
      c.var.logger.warn({ deliveryId: event.deliveryId }, "notification delivery webhook missing announcement");
      ignored += 1;
      continue;
    }

    const actor = createSystemActorMetadata({
      systemId: "notification-delivery-webhook",
      schoolId: announcement.schoolId,
      requestId: `notification-delivery-webhook:${randomUUID()}`,
      reason: "notification delivery lifecycle webhook",
    });
    const service = c.var.schoolApp.forActor(actor);
    const updated = await service.communicationsWorkflow.applyDeliveryEvent({
      deliveryId: event.deliveryId,
      status: DELIVERY_STATUS_BY_EVENT[event.status],
      providerMessageId: event.providerMessageId,
      failureReason: event.failureReason,
      occurredAt: event.occurredAt,
    });

    if (!updated || updated.status === delivery.status) {
      ignored += 1;
      continue;
    }

    processed += 1;
  }

  if (events.length === 0) {
    ignored += 1;
  }

  return c.json({ processed, ignored }, HttpStatusCodes.OK);
};
