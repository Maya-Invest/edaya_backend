import { randomUUID } from "node:crypto";
import type { NormalizedDeliveryEvent } from "@edaya/core";
import type { EmailTransportPort } from "../email/port";
import type { FcmTransport } from "../push/fcm";
import {
  getRecipient,
  listDevices,
  listJobRecipients,
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

async function bounded<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Notification provider timed out")), 30_000);
    })]);
  }
  finally {
    clearTimeout(timer);
  }
}

export async function sendJob(idempotencyKey: string, deps: SendJobDependencies): Promise<void> {
  const leaseId = randomUUID();
  const [job] = await deps.sql.query<import("../store/types").NotifyJobRow>(`
    UPDATE notify.jobs SET status = 'sending', lease_id = $2,
      lease_expires_at = NOW() + INTERVAL '5 minutes', attempts = attempts + 1, updated_at = NOW()
    WHERE idempotency_key = $1 AND status IN ('pending', 'failed', 'sending')
      AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
      AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()) AND attempts < 5
    RETURNING *`, [idempotencyKey, leaseId]);
  if (!job)
    return;

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
      if (!await upsertJobRecipient(deps.sql, {
        idempotency_key: idempotencyKey,
        subject_id: subjectId,
        channel: "none",
        status: "cancelled",
        provider_message_id: null,
        failure_reason: "no matching channels",
      }, leaseId)) {
        return;
      }
      continue;
    }

    for (const channel of channels) {
      if (recipientRows.some(row => row.subject_id === subjectId && row.channel === channel && row.status === "sent")) {
        anySent = true;
        continue;
      }
      const renewed = await deps.sql.query<{ idempotency_key: string }>(`
        UPDATE notify.jobs SET lease_expires_at = NOW() + INTERVAL '5 minutes'
        WHERE idempotency_key = $1 AND lease_id = $2 AND status = 'sending'
        RETURNING idempotency_key`, [idempotencyKey, leaseId]);
      if (!renewed.length)
        return;
      try {
        if (channel === "email" && recipient?.email) {
          const sent = await bounded(deps.email.send({
            to: recipient.email,
            from: deps.from,
            subject: job.email_subject ?? job.title,
            html: job.email_body ?? job.body,
            text: job.body,
            idempotencyKey: `${idempotencyKey}:${subjectId}:email`,
          }));
          lastProviderId = sent.providerMessageId;
          anySent = true;
          if (!await upsertJobRecipient(deps.sql, {
            idempotency_key: idempotencyKey,
            subject_id: subjectId,
            channel: "email",
            status: "sent",
            provider_message_id: sent.providerMessageId ?? null,
            failure_reason: null,
          }, leaseId)) {
            return;
          }
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
          const sent = await bounded(deps.fcm.send({
            token: fcm.token,
            title: job.title,
            body: job.body,
            data: {
              deliveryId: idempotencyKey,
              eventKey: job.event_key,
              title: job.title,
              body: job.body,
            },
          }));
          lastProviderId = sent.providerMessageId;
          anySent = true;
          if (!await upsertJobRecipient(deps.sql, {
            idempotency_key: idempotencyKey,
            subject_id: subjectId,
            channel: "push",
            status: "sent",
            provider_message_id: sent.providerMessageId ?? null,
            failure_reason: null,
          }, leaseId)) {
            return;
          }
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
        if (!await upsertJobRecipient(deps.sql, {
          idempotency_key: idempotencyKey,
          subject_id: subjectId,
          channel,
          status: "failed",
          provider_message_id: null,
          failure_reason: failureReason,
        }, leaseId)) {
          return;
        }
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

  const failed = lastFailure !== undefined || !anySent;
  await deps.sql.execute(`UPDATE notify.jobs SET status = $3, provider_message_id = COALESCE($4, provider_message_id),
    failure_reason = $5, lease_id = NULL, lease_expires_at = NULL,
    next_attempt_at = CASE WHEN $3 = 'failed' THEN NOW() + INTERVAL '1 minute' ELSE NULL END, updated_at = NOW()
    WHERE idempotency_key = $1 AND lease_id = $2`, [idempotencyKey, leaseId, failed ? "failed" : "sent", lastProviderId ?? null, failed ? lastFailure ?? "no channels delivered" : null]);

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
