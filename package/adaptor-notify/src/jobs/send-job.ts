import { recoverInterruptedSms } from "./recover-sms";
import type { EmailTransportPort, NormalizedDeliveryEvent, ResolveInvitationDispatchRecipient, ResolveNotificationDispatchRecipient, SmsTransportPort } from "@edaya/core";
import type { FcmTransport } from "../push/fcm";
import type { NotifySql } from "../store/types";
import { randomUUID } from "node:crypto";
import { buildNotifyChannelId, normalizeEmail } from "../ids";
import {
  deleteDevice,
  getCommandRecipient,
  listDevices,
  listJobRecipients,
  upsertJobRecipient,
} from "../store/queries";
import type { NotifySendChannel } from "./route-channels";
import { resolveSendChannels } from "./route-channels";

export interface SendJobDependencies {
  sql: NotifySql;
  email: EmailTransportPort;
  sms: SmsTransportPort;
  fcm: FcmTransport;
  from: { email: string; name?: string };
  resolveSchoolRecipient?: ResolveNotificationDispatchRecipient;
  resolveInvitationRecipient?: ResolveInvitationDispatchRecipient;
  onDeliveryEvent?: (event: NormalizedDeliveryEvent) => Promise<void>;
  log: (message: string, extra?: Record<string, unknown>) => void;
}

function shouldReportDelivery(jobKind: string): boolean {
  return jobKind === "school";
}

function parseStringMetadata(raw: string | null): Record<string, string> | undefined {
  let parsed: unknown;
  try {
    parsed = raw === null ? {} : JSON.parse(raw);
  }
  catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some(value => typeof value !== "string"))
    return undefined;
  return parsed as Record<string, string>;
}

function metadataFlag(metadata: Record<string, string>, key: string, fallback: boolean): boolean {
  const value = metadata[key];
  if (value === undefined)
    return fallback;
  return value === "true";
}

function metadataString(metadata: Record<string, string> | undefined, key: string): string | undefined {
  return metadata?.[key];
}

function schoolCandidateChannels(metadata: Record<string, string> | undefined): NotifySendChannel[] {
  if (!metadata)
    return ["email", "push", "sms"];
  const channels: NotifySendChannel[] = [];
  if (metadataFlag(metadata, "enableEmail", true))
    channels.push("email");
  if (metadataFlag(metadata, "enablePush", true))
    channels.push("push");
  if (metadataFlag(metadata, "enableSms", false))
    channels.push("sms");
  return channels;
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
  await recoverInterruptedSms(deps.sql, idempotencyKey);
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
  let terminalFailure: string | undefined;
  let lastProviderId: string | undefined;
  const metadata = parseStringMetadata(job.metadata);
  const candidateChannels: readonly NotifySendChannel[] = job.job_kind === "invitation"
    ? [metadataString(metadata, "contactChannel") === "phone" ? "sms" : "email"]
    : schoolCandidateChannels(metadata);

  for (const subjectId of subjectIds) {
    let subjectSent = recipientRows.some(row => row.subject_id === subjectId && row.status === "sent");
    anySent ||= subjectSent;
    let subjectTerminal = false;
    for (const channel of candidateChannels) {
      const previous = recipientRows.find(row => row.subject_id === subjectId && row.channel === channel);
      if (channel === "sms" && previous && ["sending", "uncertain", "rejected"].includes(previous.status)) {
        const reason = previous.status === "rejected" ? previous.failure_reason ?? "SMS_REJECTED" : "SMS_DELIVERY_UNCERTAIN";
        terminalFailure = reason;
        subjectTerminal = true;
        events.push({ deliveryId: job.delivery_id, subjectId, channel, status: "failed", failureReason: reason, occurredAt: new Date() });
        continue;
      }
      if (recipientRows.some(row => row.subject_id === subjectId && row.channel === channel && row.status === "sent"))
        continue;
      const renewed = await deps.sql.query<{ idempotency_key: string }>(`
        UPDATE notify.jobs SET lease_expires_at = clock_timestamp() + INTERVAL '5 minutes'
        WHERE idempotency_key = $1 AND lease_id = $2 AND status = 'sending' AND lease_expires_at > clock_timestamp()
        RETURNING idempotency_key`, [idempotencyKey, leaseId]);
      if (!renewed.length)
        return;
      let smsAttemptStarted = false;
      try {
        const recipient = job.job_kind === "school"
          ? (metadata
              ? await bounded(resolveSchoolRecipient(job, subjectId, metadata, deps))
              : undefined)
          : job.job_kind === "invitation"
            ? await bounded(resolveInvitationRecipient(job, subjectId, deps))
            : await getCommandRecipient(deps.sql, subjectId, job.tenant);
        if (!resolveSendChannels(recipient, { channels: candidateChannels }).includes(channel)) {
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
          const devices = (await listDevices(deps.sql, subjectId, job.tenant)).filter(device =>
            device.provider === "fcm" && device.profile_kind === recipient?.recipient_kind && device.profile_id === recipient?.recipient_id);
          for (const device of devices) {
            const deviceChannel = `push:${encodeURIComponent(device.app_id)}:${encodeURIComponent(device.installation_id)}`;
            if (recipientRows.some(row => row.subject_id === subjectId && row.channel === deviceChannel && (row.status === "sent" || row.status === "cancelled")))
              continue;
            let status = "sent";
            let providerMessageId: string | undefined;
            let failure: string | undefined;
            try {
              const sent = await bounded(deps.fcm.send({ token: device.token, title: job.title, body: job.body, data: { deliveryId: job.delivery_id, eventKey: job.event_key, title: job.title, body: job.body } }));
              providerMessageId = sent.providerMessageId;
              lastProviderId = providerMessageId;
              anySent = true;
              subjectSent = true;
            }
            catch (error) {
              if (error instanceof Error && error.message === "FCM_TOKEN_UNREGISTERED") {
                await deleteDevice(deps.sql, subjectId, device.provider, job.tenant, device.app_id, device.installation_id, device.token);
                status = "cancelled";
                failure = "FCM_TOKEN_UNREGISTERED";
              }
              else {
                status = "failed";
                failure = "NOTIFY_DELIVERY_FAILED";
                lastFailure = failure;
              }
            }
            if (!await upsertJobRecipient(deps.sql, { idempotency_key: idempotencyKey, subject_id: subjectId, channel: deviceChannel, status, provider_message_id: providerMessageId ?? null, failure_reason: failure ?? null }, leaseId)) {
              return;
            }
            if (status === "sent")
              events.push({ deliveryId: job.delivery_id, status: "sent", providerMessageId, channel: "push", occurredAt: new Date(), subjectId });
          }
        }
        else if (channel === "sms") {
          if (!deps.sms.implemented) {
            if (!await upsertJobRecipient(deps.sql, {
              idempotency_key: idempotencyKey,
              subject_id: subjectId,
              channel,
              status: "cancelled",
              provider_message_id: null,
              failure_reason: "sms transport unimplemented",
            }, leaseId)) {
              return;
            }
            continue;
          }
          if (!recipient?.phone) {
            if (!await upsertJobRecipient(deps.sql, {
              idempotency_key: idempotencyKey,
              subject_id: subjectId,
              channel,
              status: "cancelled",
              provider_message_id: null,
              failure_reason: "no phone number",
            }, leaseId)) {
              return;
            }
            continue;
          }
          // The marker is committed on the delivery executor before the external side effect.
          if (!await upsertJobRecipient(deps.sql, {
            idempotency_key: idempotencyKey,
            subject_id: subjectId,
            channel,
            status: "sending",
            provider_message_id: null,
            failure_reason: "SMS_DELIVERY_UNCERTAIN",
          }, leaseId)) {
            return;
          }
          smsAttemptStarted = true;
          const result = await bounded(deps.sms.send({
            to: recipient.phone,
            body: job.sms_body ?? job.body,
            idempotencyKey: buildNotifyChannelId(idempotencyKey, subjectId, "sms"),
          }));
          const accepted = result.status === "accepted";
          const retryable = result.status === "rejected" && result.retryable;
          const reason = result.status === "uncertain" ? "SMS_DELIVERY_UNCERTAIN" : result.status === "rejected" ? result.reason : null;
          if (!await upsertJobRecipient(deps.sql, {
            idempotency_key: idempotencyKey,
            subject_id: subjectId,
            channel,
            status: accepted ? "sent" : result.status === "uncertain" ? "uncertain" : retryable ? "failed" : "rejected",
            provider_message_id: accepted ? result.providerMessageId : null,
            failure_reason: reason,
          }, leaseId)) {
            return;
          }
          if (accepted) {
            lastProviderId = result.providerMessageId;
            anySent = true;
            subjectSent = true;
          }
          else if (retryable) {
            lastFailure = reason!;
          }
          else {
            terminalFailure = reason!;
            subjectTerminal = true;
          }
          events.push({ deliveryId: job.delivery_id, status: accepted ? "sent" : "failed", providerMessageId: accepted ? result.providerMessageId : undefined, channel, failureReason: reason ?? undefined, occurredAt: new Date(), subjectId });
        }
      }
      catch {
        const failureReason = smsAttemptStarted ? "SMS_DELIVERY_UNCERTAIN" : "NOTIFY_DELIVERY_FAILED";
        if (smsAttemptStarted) {
          terminalFailure = failureReason;
          subjectTerminal = true;
        }
        else {
          lastFailure = failureReason;
        }
        deps.log("notify send failed", { idempotencyKey, subjectId, channel, code: failureReason });
        if (!await upsertJobRecipient(deps.sql, {
          idempotency_key: idempotencyKey,
          subject_id: subjectId,
          channel,
          status: smsAttemptStarted ? "uncertain" : "failed",
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
    if (!subjectSent && !lastFailure && !subjectTerminal)
      events.push({ deliveryId: job.delivery_id, subjectId, status: "cancelled", occurredAt: new Date(), failureReason: "recipient or channels no longer eligible" });
  }

  const failed = lastFailure !== undefined;
  const completed = await deps.sql.query<{ idempotency_key: string }>(`UPDATE notify.jobs SET status = $3, provider_message_id = COALESCE($4, provider_message_id),
    failure_reason = $5, lease_id = NULL, lease_expires_at = NULL,
    next_attempt_at = CASE WHEN $3 = 'failed' THEN clock_timestamp() + INTERVAL '1 minute' ELSE NULL END, updated_at = clock_timestamp()
    WHERE idempotency_key = $1 AND lease_id = $2 AND status = 'sending' AND lease_expires_at > clock_timestamp() RETURNING idempotency_key`, [idempotencyKey, leaseId, failed ? (Number(job.attempts) >= 5 ? "dead" : "failed") : terminalFailure ? "dead" : anySent ? "sent" : "cancelled", lastProviderId ?? null, failed ? lastFailure ?? "no channels delivered" : terminalFailure ?? null]);

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

async function resolveSchoolRecipient(job: import("../store/types").NotifyJobRow, subjectId: string, metadata: Record<string, string>, deps: SendJobDependencies): Promise<Parameters<typeof resolveSendChannels>[0]> {
  if (!deps.resolveSchoolRecipient)
    throw new Error("School notification recipient resolver is required");
  const profile = await deps.resolveSchoolRecipient({
    deliveryId: job.delivery_id,
    schoolId: job.tenant,
    subjectId,
    eventKey: job.event_key,
    metadata,
  });
  if (!profile || profile.schoolId !== job.tenant || profile.recipient.subjectId !== subjectId || !profile.recipient.id)
    return undefined;
  return {
    recipient_kind: profile.recipient.kind,
    recipient_id: profile.recipient.id,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    allows_notifications: profile.preferences.allowsNotifications ?? true,
    channel_email: metadataFlag(metadata, "enableEmail", true) && (profile.preferences.channels?.email ?? false),
    channel_push: metadataFlag(metadata, "enablePush", true) && (profile.preferences.channels?.push ?? false),
    channel_sms: metadataFlag(metadata, "enableSms", false) && (profile.preferences.channels?.sms ?? false),
  };
}

async function resolveInvitationRecipient(job: import("../store/types").NotifyJobRow, subjectId: string, deps: SendJobDependencies): Promise<Parameters<typeof resolveSendChannels>[0]> {
  if (!deps.resolveInvitationRecipient)
    throw new Error("Invitation recipient resolver is required");
  const current = await deps.resolveInvitationRecipient({ schoolId: job.tenant, invitationId: job.delivery_id });
  if (!current || current.schoolId !== job.tenant || current.invitationId !== job.delivery_id)
    return undefined;
  const recipient = await getCommandRecipient(deps.sql, subjectId, job.tenant);
  if (current.contactChannel === "phone") {
    if (!recipient?.phone || recipient.phone !== current.contactValue)
      return undefined;
    return recipient;
  }
  if (!recipient?.email || normalizeEmail(recipient.email) !== normalizeEmail(current.contactValue))
    return undefined;
  return recipient;
}
