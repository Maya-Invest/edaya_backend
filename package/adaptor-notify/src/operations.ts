import type {
  AuthOtpEmailInput,
  AuthVerificationEmailInput,
  InvitationDeliveryInput,
  NotificationDeliveryStatusLookup,
  NotificationDeliveryStatusQuery,
  NotificationEnqueueInput,
  RegisterPushDeviceInput,
  UnregisterPushDeviceInput,
} from "@edaya/core";
import type { SendJobDependencies } from "./jobs/send-job";
import type { NotifyRuntime } from "./runtime";
import { formatOtpEmail, formatVerificationLinkEmail } from "./email/auth-copy";
import { NotifySendError } from "./errors";
import { buildAuthRecipientId, buildInvitationRecipientId, buildNotifyJobId, normalizeEmail, NOTIFY_PLATFORM_TENANT } from "./ids";
import { sendJob } from "./jobs/send-job";
import {
  cancelJob,
  deleteCommandRecipient,
  deleteDevice,
  getJob,
  insertJobIfAbsent,
  lookupJobRecipients,
  upsertCommandRecipient,
  upsertDevice,
  upsertJobRecipient,
} from "./store/queries";

function sendDeps(runtime: NotifyRuntime): SendJobDependencies {
  return {
    sql: runtime.sql,
    email: runtime.email,
    fcm: runtime.fcm,
    from: runtime.from,
    log: runtime.log,
    onDeliveryEvent: runtime.onDeliveryEvent,
    resolveSchoolRecipient: runtime.resolveSchoolRecipient,
    resolveInvitationRecipient: runtime.resolveInvitationRecipient,
  };
}

async function sendAwaitedJob(runtime: NotifyRuntime, idempotencyKey: string, failureMessage: string): Promise<void> {
  await sendJob(idempotencyKey, sendDeps(runtime));
  const job = await getJob(runtime.sql, idempotencyKey);
  if (job?.status !== "sent") {
    throw new NotifySendError(job?.failure_reason ?? failureMessage);
  }
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
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
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
  await deleteDevice(runtime.sql, input.subjectId, input.provider, input.schoolId);
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
  if (input.contactChannel !== "email")
    throw new NotifySendError("INVITATION_CHANNEL_UNSUPPORTED");
  const subjectId = buildInvitationRecipientId(input.invitationId);
  const jobId = buildNotifyJobId("invitation", input.schoolId, input.invitationId);
  const email = input.contactChannel === "email" ? input.contactValue : undefined;
  await upsertCommandRecipient(runtime.sql, {
    subject_id: subjectId,
    tenant: input.schoolId,
    email: email ?? null,
    display_name: input.displayName,
    locale: null,
    allows_notifications: true,
    channel_email: input.contactChannel === "email",
    channel_push: false,
    recipient_kind: input.actorKind,
    recipient_id: input.invitationId,
  });
  await insertJobIfAbsent(runtime.sql, {
    idempotency_key: jobId,
    tenant: input.schoolId,
    job_kind: "invitation",
    delivery_id: input.invitationId,
    event_key: "account_invitation",
    title: input.emailSubject,
    body: input.emailBody,
    email_subject: input.emailSubject,
    email_body: input.emailBody,
    metadata: JSON.stringify({ inviteUrl: input.inviteUrl }),
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

export async function sendAuthOtp(runtime: NotifyRuntime, input: AuthOtpEmailInput): Promise<void> {
  const email = normalizeEmail(input.email);
  const subjectId = buildAuthRecipientId(email);
  const copy = formatOtpEmail(input);
  await upsertCommandRecipient(runtime.sql, {
    subject_id: subjectId,
    tenant: NOTIFY_PLATFORM_TENANT,
    email,
    display_name: email,
    locale: null,
    allows_notifications: true,
    channel_email: true,
    channel_push: false,
    recipient_kind: "staff",
    recipient_id: email,
  });
  const deliveryId = crypto.randomUUID();
  const idempotencyKey = buildNotifyJobId("auth_otp", NOTIFY_PLATFORM_TENANT, deliveryId);
  await insertJobIfAbsent(runtime.sql, {
    idempotency_key: idempotencyKey,
    tenant: NOTIFY_PLATFORM_TENANT,
    job_kind: "auth_otp",
    delivery_id: deliveryId,
    event_key: "auth.otp",
    title: copy.subject,
    body: copy.body,
    email_subject: copy.subject,
    email_body: copy.body,
    metadata: JSON.stringify({ otpType: input.type }),
  });
  await upsertJobRecipient(runtime.sql, {
    idempotency_key: idempotencyKey,
    subject_id: subjectId,
    channel: "queued",
    status: "pending",
    provider_message_id: null,
    failure_reason: null,
  });
  await sendAwaitedJob(runtime, idempotencyKey, "auth otp send failed");
}

export async function sendAuthVerification(
  runtime: NotifyRuntime,
  input: AuthVerificationEmailInput,
): Promise<void> {
  const email = normalizeEmail(input.email);
  const subjectId = buildAuthRecipientId(email);
  const copy = formatVerificationLinkEmail(input);
  await upsertCommandRecipient(runtime.sql, {
    subject_id: subjectId,
    tenant: NOTIFY_PLATFORM_TENANT,
    email,
    display_name: input.displayName ?? email,
    locale: null,
    allows_notifications: true,
    channel_email: true,
    channel_push: false,
    recipient_kind: "staff",
    recipient_id: email,
  });
  const deliveryId = crypto.randomUUID();
  const idempotencyKey = buildNotifyJobId("auth_verification", NOTIFY_PLATFORM_TENANT, deliveryId);
  await insertJobIfAbsent(runtime.sql, {
    idempotency_key: idempotencyKey,
    tenant: NOTIFY_PLATFORM_TENANT,
    job_kind: "auth_verification",
    delivery_id: deliveryId,
    event_key: "auth.email_verification",
    title: copy.subject,
    body: copy.body,
    email_subject: copy.subject,
    email_body: copy.body,
    metadata: JSON.stringify({ verifyUrl: input.url }),
  });
  await upsertJobRecipient(runtime.sql, {
    idempotency_key: idempotencyKey,
    subject_id: subjectId,
    channel: "queued",
    status: "pending",
    provider_message_id: null,
    failure_reason: null,
  });
  await sendAwaitedJob(runtime, idempotencyKey, "auth verification send failed");
}
