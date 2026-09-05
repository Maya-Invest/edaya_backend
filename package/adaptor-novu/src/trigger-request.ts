import type { NotificationEnqueueInput } from "@edaya/core";
import { buildNovuSubscriberIds } from "./subscriber-id";
import type { NovuTriggerRequest, NovuTriggerTo, NovuWorkflowIdResolver } from "./types";

const NOVU_MAX_RECIPIENTS_PER_TRIGGER = 100;

export const defaultNovuWorkflowIdResolver: NovuWorkflowIdResolver = input => input.eventKey;

export function mapNotificationToNovuTriggerRequest(
  input: NotificationEnqueueInput,
  resolveWorkflowId: NovuWorkflowIdResolver = defaultNovuWorkflowIdResolver,
): NovuTriggerRequest {
  const subscriberIds = buildNovuSubscriberIds(input.recipients);
  if (subscriberIds.length === 0) {
    throw new Error("NotificationEnqueueInput must include at least one recipient with subjectId");
  }

  return {
    workflowId: resolveWorkflowId(input),
    to: subscriberIds.length === 1 ? subscriberIds[0]! : subscriberIds,
    transactionId: input.idempotencyKey,
    context: {
      tenant: input.schoolId,
    },
    payload: {
      title: input.title,
      body: input.body,
      emailSubject: input.emailSubject ?? input.title,
      emailBody: input.emailBody ?? input.body,
      kind: input.kind,
      eventKey: input.eventKey,
      schoolId: input.schoolId,
      announcementId: input.announcementId,
      priority: input.priority,
      deliverAfter: input.deliverAfter?.toISOString(),
      expiresAt: input.expiresAt?.toISOString(),
      metadata: input.metadata,
      recipients: input.recipients,
    },
  };
}

export function chunkNovuTriggerRequests(
  request: NovuTriggerRequest,
): NovuTriggerRequest[] {
  const recipients = Array.isArray(request.to) ? request.to : [request.to];
  if (recipients.length <= NOVU_MAX_RECIPIENTS_PER_TRIGGER) {
    return [request];
  }

  const chunks: NovuTriggerRequest[] = [];
  for (let index = 0; index < recipients.length; index += NOVU_MAX_RECIPIENTS_PER_TRIGGER) {
    const slice = recipients.slice(index, index + NOVU_MAX_RECIPIENTS_PER_TRIGGER);
    chunks.push({
      ...request,
      to: (slice.length === 1 ? slice[0]! : slice) as NovuTriggerTo,
      transactionId: `${request.transactionId}:${index / NOVU_MAX_RECIPIENTS_PER_TRIGGER}`,
    });
  }
  return chunks;
}
