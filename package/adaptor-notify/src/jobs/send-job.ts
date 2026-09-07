import type { NormalizedDeliveryEvent } from "@edaya/core";
import type { EmailTransportPort } from "../email/port";
import type { FcmTransport } from "../push/fcm";
import {
  getJob,
  getRecipient,
  listDevices,
  listJobRecipients,
  updateJobStatus,
  upsertJobRecipient,
} from "../store/queries";
import type { NotifySql } from "../store/types";
import { resolveSendChannels } from "./route-channels";

export interface SendJobDependencies {
  sql: NotifySql;
  email: EmailTransportPort;
  fcm: FcmTransport;
  from: { email: string; name?: string };
  onDeliveryEvent?: (event: NormalizedDeliveryEvent) => Promise<void>;
  log: (message: string, extra?: Record<string, unknown>) => void;
}

function emailOnlyJob(jobKind: string): boolean {
  return jobKind === "invitation" || jobKind === "auth_otp" || jobKind === "auth_verification";
}

function shouldReportDelivery(jobKind: string): boolean {
  return jobKind === "school";
}

export async function sendJob(idempotencyKey: string, deps: SendJobDependencies): Promise<void> {
  const job = await getJob(deps.sql, idempotencyKey);
  if (!job) {
    return;
  }
  if (job.status === "cancelled" || job.status === "sent") {
    return;
  }

  await updateJobStatus(deps.sql, idempotencyKey, "sending");

  const recipientRows = await listJobRecipients(deps.sql, idempotencyKey);
  const subjectIds = [...new Set(recipientRows.map(row => row.subject_id))];
  const events: NormalizedDeliveryEvent[] = [];
  let anySent = false;
  let lastFailure: string | undefined;
  let lastProviderId: string | undefined;

  for (const subjectId of subjectIds) {
    const recipient = await getRecipient(deps.sql, subjectId);
    const channels = resolveSendChannels(recipient, { emailOnly: emailOnlyJob(job.job_kind) });
    if (channels.length === 0) {
      await upsertJobRecipient(deps.sql, {
        idempotency_key: idempotencyKey,
        subject_id: subjectId,
        channel: "none",
        status: "cancelled",
        provider_message_id: null,
        failure_reason: "no matching channels",
      });
      continue;
    }

    for (const channel of channels) {
      try {
        if (channel === "email" && recipient?.email) {
          const sent = await deps.email.send({
            to: recipient.email,
            from: deps.from,
            subject: job.email_subject ?? job.title,
            html: job.email_body ?? job.body,
            text: job.body,
            idempotencyKey: `${idempotencyKey}:${subjectId}:email`,
          });
          lastProviderId = sent.providerMessageId;
          anySent = true;
          await upsertJobRecipient(deps.sql, {
            idempotency_key: idempotencyKey,
            subject_id: subjectId,
            channel: "email",
            status: "sent",
            provider_message_id: sent.providerMessageId ?? null,
            failure_reason: null,
          });
          events.push({
            deliveryId: idempotencyKey,
            status: "sent",
            providerMessageId: sent.providerMessageId,
            channel: "email",
            occurredAt: new Date(),
            subjectId,
          });
        }
        else if (channel === "push") {
          const devices = await listDevices(deps.sql, subjectId);
          const fcm = devices.find(device => device.provider === "fcm");
          if (!fcm) {
            continue;
          }
          const sent = await deps.fcm.send({
            token: fcm.token,
            title: job.title,
            body: job.body,
            data: {
              deliveryId: idempotencyKey,
              eventKey: job.event_key,
              title: job.title,
              body: job.body,
            },
          });
          lastProviderId = sent.providerMessageId;
          anySent = true;
          await upsertJobRecipient(deps.sql, {
            idempotency_key: idempotencyKey,
            subject_id: subjectId,
            channel: "push",
            status: "sent",
            provider_message_id: sent.providerMessageId ?? null,
            failure_reason: null,
          });
          events.push({
            deliveryId: idempotencyKey,
            status: "sent",
            providerMessageId: sent.providerMessageId,
            channel: "push",
            occurredAt: new Date(),
            subjectId,
          });
        }
      }
      catch (error) {
        const failureReason = error instanceof Error ? error.message : String(error);
        lastFailure = failureReason;
        deps.log("notify send failed", { idempotencyKey, subjectId, channel, err: failureReason });
        await upsertJobRecipient(deps.sql, {
          idempotency_key: idempotencyKey,
          subject_id: subjectId,
          channel,
          status: "failed",
          provider_message_id: null,
          failure_reason: failureReason,
        });
        events.push({
          deliveryId: idempotencyKey,
          status: "failed",
          channel,
          failureReason,
          occurredAt: new Date(),
          subjectId,
        });
      }
    }
  }

  if (anySent) {
    await updateJobStatus(deps.sql, idempotencyKey, "sent", { providerMessageId: lastProviderId });
  }
  else {
    await updateJobStatus(deps.sql, idempotencyKey, "failed", { failureReason: lastFailure ?? "no channels delivered" });
  }

  if (shouldReportDelivery(job.job_kind) && events.length > 0 && deps.onDeliveryEvent) {
    for (const event of events) {
      try {
        await deps.onDeliveryEvent(event);
      }
      catch (error) {
        deps.log("notify delivery event failed", {
          idempotencyKey,
          deliveryId: event.deliveryId,
          err: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
