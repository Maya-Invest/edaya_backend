import type {
  InvitationDeliveryInput,
  NotificationDeliveryStatusLookup,
  NotificationDeliveryStatusQuery,
  NotificationEnqueueInput,
  RegisterPushDeviceInput,
  UnregisterPushDeviceInput,
} from "@edaya/core";
import type { NotifyRuntime } from "./runtime";
import { NotifySendError } from "./errors";
import { buildInvitationRecipientId, buildNotifyJobId, normalizeEmail } from "./ids";
import {
  cancelJob,
  deleteCommandRecipient,
  deleteDevice,
  insertJobIfAbsent,
  lookupJobRecipients,
  upsertCommandRecipient,
  upsertDevice,
  upsertJobRecipient,
} from "./store/queries";

function schoolJobMetadata(input: NotificationEnqueueInput): string {
  return JSON.stringify({
    ...input.metadata,
    enableEmail: String(input.enableEmail ?? true),
    enablePush: String(input.enablePush ?? true),
    enableSms: String(input.enableSms ?? false),
  });
}

export async function enqueueSchoolNotification(
  runtime: NotifyRuntime,
  input: NotificationEnqueueInput,
): Promise<void> {
  const subjectIds = input.recipients
    .map(recipient => recipient.subjectId)
    .filter((value): value is string => Boolean(value));
  if (subjectIds.length === 0) {
    return;
  }

  const { created } = await insertJobIfAbsent(runtime.sql, {
    idempotency_key: buildNotifyJobId("school", input.schoolId, input.idempotencyKey),
    tenant: input.schoolId,
    job_kind: "school",
    delivery_id: input.idempotencyKey,
    event_key: input.eventKey,
    title: input.title,
    body: input.body,
    email_subject: input.emailSubject ?? input.title,
    email_body: input.emailBody ?? input.body,
    sms_body: input.smsBody ?? null,
    metadata: schoolJobMetadata(input),
  });
  if (!created) {
    return;
  }

  for (const subjectId of subjectIds) {
    await upsertJobRecipient(runtime.sql, {
      idempotency_key: buildNotifyJobId("school", input.schoolId, input.idempotencyKey),
      subject_id: subjectId,
      channel: "queued",
      status: "pending",
      provider_message_id: null,
      failure_reason: null,
    });
  }
  // The durable job and recipients commit with the school transaction.
  // The scheduled dispatcher delivers them after commit.
}

export async function cancelSchoolNotification(
  runtime: NotifyRuntime,
  idempotencyKey: string,
  schoolId: string,
): Promise<void> {
  await cancelJob(runtime.sql, buildNotifyJobId("school", schoolId, idempotencyKey), schoolId);
}

export async function registerSchoolPushDevice(
  runtime: NotifyRuntime,
  input: RegisterPushDeviceInput,
): Promise<void> {
  await upsertDevice(runtime.sql, {
    app_id: input.appId,
    installation_id: input.installationId,
    profile_kind: input.profileKind,
    profile_id: input.profileId,
    tenant: input.schoolId,
    subject_id: input.subjectId,
    provider: input.provider,
    token: input.token,
  });
}

export async function unregisterSchoolPushDevice(
  runtime: NotifyRuntime,
  input: UnregisterPushDeviceInput,
): Promise<void> {
  await deleteDevice(runtime.sql, input.subjectId, input.provider, input.schoolId, input.appId, input.installationId);
}

export async function lookupSchoolDeliveryStatuses(
  runtime: NotifyRuntime,
  deliveries: ReadonlyArray<NotificationDeliveryStatusQuery>,
): Promise<Map<string, NotificationDeliveryStatusLookup>> {
  const result = new Map<string, NotificationDeliveryStatusLookup>();
  const rows = await lookupJobRecipients(runtime.sql, deliveries);
  for (const query of deliveries) {
    const matches = rows.filter(row =>
      row.idempotency_key === buildNotifyJobId("school", query.schoolId, query.deliveryId) && row.subject_id === query.subjectId && row.channel !== "queued",
    );
    const sent = matches.find(row => row.status === "sent");
    const failed = matches.find(row => row.status === "failed");
    const cancelled = matches.find(row => row.status === "cancelled");
    const chosen = sent ?? failed ?? cancelled;
    if (!chosen) {
      continue;
    }
    if (chosen.status !== "sent" && chosen.status !== "failed" && chosen.status !== "cancelled" && chosen.status !== "read") {
      continue;
    }
    result.set(query.deliveryId, {
      status: chosen.status,
      providerMessageId: chosen.provider_message_id ?? undefined,
      failureReason: chosen.failure_reason ?? undefined,
    });
  }
  return result;
}

export async function deliverInvitation(
  runtime: NotifyRuntime,
  input: InvitationDeliveryInput,
): Promise<void> {
  if (input.contactChannel !== "email" && input.contactChannel !== "phone")
    throw new NotifySendError("INVITATION_CHANNEL_UNSUPPORTED");
  if (input.contactChannel === "phone" && !runtime.sms.implemented)
    throw new NotifySendError("SMS_TRANSPORT_UNIMPLEMENTED");

  const subjectId = buildInvitationRecipientId(input.invitationId);
  const jobId = buildNotifyJobId("invitation", input.schoolId, input.invitationId);
  const email = input.contactChannel === "email" ? normalizeEmail(input.contactValue) : null;
  const phone = input.contactChannel === "phone" ? input.contactValue : null;
  await upsertCommandRecipient(runtime.sql, {
    subject_id: subjectId,
    tenant: input.schoolId,
    email,
    phone,
    display_name: input.displayName,
    locale: null,
    allows_notifications: true,
    channel_email: input.contactChannel === "email",
    channel_push: false,
    channel_sms: input.contactChannel === "phone",
    recipient_kind: input.actorKind,
    recipient_id: input.invitationId,
  });
  await insertJobIfAbsent(runtime.sql, {
    idempotency_key: jobId,
    tenant: input.schoolId,
    job_kind: "invitation",
    delivery_id: input.invitationId,
    event_key: "account_invitation",
    title: input.emailSubject ?? input.smsBody ?? "Invitation",
    body: input.emailBody ?? input.smsBody ?? "",
    email_subject: input.emailSubject ?? null,
    email_body: input.emailBody ?? null,
    sms_body: input.smsBody ?? null,
    metadata: JSON.stringify({
      inviteUrl: input.inviteUrl,
      contactChannel: input.contactChannel,
    }),
  });
  await upsertJobRecipient(runtime.sql, {
    idempotency_key: jobId,
    subject_id: subjectId,
    channel: "queued",
    status: "pending",
    provider_message_id: null,
    failure_reason: null,
  });
  // The invitation and durable intent commit together. The shared dispatcher
  // resolves the current invitation before contacting the provider after commit.
}

export async function revokeInvitation(runtime: NotifyRuntime, invitationId: string, schoolId: string): Promise<void> {
  await cancelJob(runtime.sql, buildNotifyJobId("invitation", schoolId, invitationId), schoolId);
  await deleteCommandRecipient(runtime.sql, buildInvitationRecipientId(invitationId), schoolId);
}
