import type { NormalizedDeliveryEvent, ResolveInvitationDispatchRecipient, ResolveNotificationDispatchRecipient } from "@edaya/core";
import type { EmailTransportPort } from "../email/port";
import type { FcmTransport } from "../push/fcm";
import type { NotifySql } from "../store/types";
import { randomUUID } from "node:crypto";
import { buildNotifyChannelId, normalizeEmail } from "../ids";
import {
  getCommandRecipient,
  listDevices,
  listJobRecipients,
  upsertJobRecipient,
} from "../store/queries";
import { resolveSendChannels } from "./route-channels";

export interface SendJobDependencies {
  sql: NotifySql;
  email: EmailTransportPort;
  fcm: FcmTransport;
  from: { email: string; name?: string };
  resolveSchoolRecipient?: ResolveNotificationDispatchRecipient;
  resolveInvitationRecipient?: ResolveInvitationDispatchRecipient;
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
  await deps.sql.execute(`UPDATE notify.jobs SET status = 'dead', lease_id = NULL, lease_expires_at = NULL,
    failure_reason = CASE WHEN payload_version <> 1 THEN 'NOTIFY_VERSION_UNSUPPORTED' ELSE 'NOTIFY_ATTEMPTS_EXHAUSTED' END,
    updated_at = clock_timestamp()
    WHERE idempotency_key = $1 AND status IN ('pending', 'failed', 'sending')
      AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp())
      AND (payload_version <> 1 OR attempts >= 5)`, [idempotencyKey]);
  const leaseId = randomUUID();
  const [job] = await deps.sql.query<import("../store/types").NotifyJobRow>(`
    UPDATE notify.jobs SET status = 'sending', lease_id = $2,
      lease_expires_at = clock_timestamp() + INTERVAL '5 minutes', attempts = attempts + 1, updated_at = clock_timestamp()
    WHERE idempotency_key = $1 AND status IN ('pending', 'failed', 'sending')
      AND (lease_expires_at IS NULL OR lease_expires_at < clock_timestamp())
      AND (next_attempt_at IS NULL OR next_attempt_at <= clock_timestamp()) AND attempts < 5 AND payload_version = 1
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
    let subjectSent = recipientRows.some(row => row.subject_id === subjectId && row.status === "sent");
    anySent ||= subjectSent;
    const channels = emailOnlyJob(job.job_kind) ? ["email"] as const : ["email", "push"] as const;
    for (const channel of channels) {
      if (recipientRows.some(row => row.subject_id === subjectId && row.channel === channel && row.status === "sent"))
        continue;
      const renewed = await deps.sql.query<{ idempotency_key: string }>(`
        UPDATE notify.jobs SET lease_expires_at = clock_timestamp() + INTERVAL '5 minutes'
        WHERE idempotency_key = $1 AND lease_id = $2 AND status = 'sending' AND lease_expires_at > clock_timestamp()
        RETURNING idempotency_key`, [idempotencyKey, leaseId]);
      if (!renewed.length)
        return;
      try {
        // School recipients have no provider contact snapshot. Auth and invitation
        // jobs retain their explicit, command-owned destination addresses.
        const recipient = job.job_kind === "school"
          ? await bounded(resolveSchoolRecipient(job, subjectId, deps))
          : job.job_kind === "invitation"
            ? await bounded(resolveInvitationRecipient(job, subjectId, deps))
            : await getCommandRecipient(deps.sql, subjectId, job.tenant);
        if (!resolveSendChannels(recipient, { emailOnly: emailOnlyJob(job.job_kind) }).includes(channel)) {
          if (!await upsertJobRecipient(deps.sql, {
            idempotency_key: idempotencyKey,
            subject_id: subjectId,
            channel,
            status: "cancelled",
            provider_message_id: null,
            failure_reason: "recipient or channel no longer eligible",
          }, leaseId)) {
            return;
          }
          continue;
        }
        if (channel === "email" && recipient?.email) {
          const sent = await bounded(deps.email.send({
            to: recipient.email,
            correlation: job.job_kind === "school" ? { deliveryId: job.delivery_id, subjectId, schoolId: job.tenant } : undefined,
            from: deps.from,
            subject: job.email_subject ?? job.title,
            html: job.email_body ?? job.body,
            text: job.body,
            idempotencyKey: buildNotifyChannelId(idempotencyKey, subjectId, "email"),
          }));
          lastProviderId = sent.providerMessageId;
          anySent = true;
          subjectSent = true;
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
            deliveryId: job.delivery_id,
            status: "sent",
            providerMessageId: sent.providerMessageId,
            channel: "email",
            occurredAt: new Date(),
            subjectId,
          });
        }
        else if (channel === "push") {
          const devices = await listDevices(deps.sql, subjectId, job.tenant);
          const fcm = devices.find(device => device.provider === "fcm");
          if (!fcm) {
            if (!await upsertJobRecipient(deps.sql, {
              idempotency_key: idempotencyKey,
              subject_id: subjectId,
              channel,
              status: "cancelled",
              provider_message_id: null,
              failure_reason: "no registered device",
            }, leaseId)) {
              return;
            }
            continue;
          }
          const sent = await bounded(deps.fcm.send({
            token: fcm.token,
            title: job.title,
            body: job.body,
            data: {
              deliveryId: job.delivery_id,
              eventKey: job.event_key,
              title: job.title,
              body: job.body,
            },
          }));
          lastProviderId = sent.providerMessageId;
          anySent = true;
          subjectSent = true;
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
            deliveryId: job.delivery_id,
            status: "sent",
            providerMessageId: sent.providerMessageId,
            channel: "push",
            occurredAt: new Date(),
            subjectId,
          });
        }
      }
      catch {
        const failureReason = "NOTIFY_DELIVERY_FAILED";
        lastFailure = failureReason;
        deps.log("notify send failed", { idempotencyKey, subjectId, channel, code: failureReason });
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
          deliveryId: job.delivery_id,
          status: "failed",
          channel,
          failureReason,
          occurredAt: new Date(),
          subjectId,
        });
      }
    }
    if (!subjectSent && !lastFailure)
      events.push({ deliveryId: job.delivery_id, subjectId, status: "cancelled", occurredAt: new Date(), failureReason: "recipient or channels no longer eligible" });
  }

  const failed = lastFailure !== undefined;
  const completed = await deps.sql.query<{ idempotency_key: string }>(`UPDATE notify.jobs SET status = $3, provider_message_id = COALESCE($4, provider_message_id),
    failure_reason = $5, lease_id = NULL, lease_expires_at = NULL,
    next_attempt_at = CASE WHEN $3 = 'failed' THEN clock_timestamp() + INTERVAL '1 minute' ELSE NULL END, updated_at = clock_timestamp()
    WHERE idempotency_key = $1 AND lease_id = $2 AND status = 'sending' AND lease_expires_at > clock_timestamp() RETURNING idempotency_key`, [idempotencyKey, leaseId, failed ? (Number(job.attempts) >= 5 ? "dead" : "failed") : anySent ? "sent" : "cancelled", lastProviderId ?? null, failed ? lastFailure ?? "no channels delivered" : null]);

  if (!completed.length)
    return;

  if (shouldReportDelivery(job.job_kind) && events.length > 0 && deps.onDeliveryEvent) {
    for (const event of events) {
      try {
        await deps.onDeliveryEvent(event);
      }
      catch {
        deps.log("notify delivery event failed", {
          idempotencyKey,
          deliveryId: event.deliveryId,
          code: "NOTIFY_DELIVERY_EVENT_FAILED",
        });
      }
    }
  }
}

async function resolveSchoolRecipient(job: import("../store/types").NotifyJobRow, subjectId: string, deps: SendJobDependencies): Promise<Parameters<typeof resolveSendChannels>[0]> {
  if (!deps.resolveSchoolRecipient)
    throw new Error("School notification recipient resolver is required");
  let metadata: unknown;
  try {
    metadata = job.metadata === null ? {} : JSON.parse(job.metadata);
  }
  catch { return undefined; }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || Object.values(metadata).some(value => typeof value !== "string"))
    return undefined;
  const profile = await deps.resolveSchoolRecipient({
    deliveryId: job.delivery_id,
    schoolId: job.tenant,
    subjectId,
    eventKey: job.event_key,
    metadata: metadata as Record<string, string>,
  });
  if (!profile || profile.schoolId !== job.tenant || profile.recipient.subjectId !== subjectId || !profile.recipient.id)
    return undefined;
  return {
    email: profile.email ?? null,
    allows_notifications: profile.preferences.allowsNotifications ?? true,
    channel_email: profile.preferences.channels?.email ?? false,
    channel_push: profile.preferences.channels?.push ?? false,
  };
}

async function resolveInvitationRecipient(job: import("../store/types").NotifyJobRow, subjectId: string, deps: SendJobDependencies): Promise<Parameters<typeof resolveSendChannels>[0]> {
  if (!deps.resolveInvitationRecipient)
    throw new Error("Invitation recipient resolver is required");
  const current = await deps.resolveInvitationRecipient({ schoolId: job.tenant, invitationId: job.delivery_id });
  if (!current || current.schoolId !== job.tenant || current.invitationId !== job.delivery_id)
    return undefined;
  const recipient = await getCommandRecipient(deps.sql, subjectId, job.tenant);
  if (!recipient?.email || normalizeEmail(recipient.email) !== normalizeEmail(current.email))
    return undefined;
  return recipient;
}
