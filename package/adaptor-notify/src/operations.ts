import type {
  AuthOtpEmailInput,
  AuthVerificationEmailInput,
  InvitationDeliveryInput,
  NotificationDeliveryStatusLookup,
  NotificationDeliveryStatusQuery,
  NotificationEnqueueInput,
  NotificationRecipient,
  NotificationRecipientProfile,
  RegisterPushDeviceInput,
  UnregisterPushDeviceInput,
} from "@edaya/core";
import { formatOtpEmail, formatVerificationLinkEmail } from "./email/auth-copy";
import { NotifySendError } from "./errors";
import { buildAuthRecipientId, buildInvitationRecipientId, normalizeEmail, NOTIFY_PLATFORM_TENANT } from "./ids";
import { sendJob } from "./jobs/send-job";
import type { SendJobDependencies } from "./jobs/send-job";
import type { NotifyRuntime } from "./runtime";
import {
  cancelJob,
  deleteDevice,
  deleteRecipient,
  getJob,
  insertJobIfAbsent,
  lookupJobRecipients,
  upsertDevice,
  upsertJobRecipient,
  upsertRecipient,
} from "./store/queries";

function sendDeps(runtime: NotifyRuntime): SendJobDependencies {
  return {
    sql: runtime.sql,
    email: runtime.email,
    fcm: runtime.fcm,
    from: runtime.from,
    log: runtime.log,
    onDeliveryEvent: runtime.onDeliveryEvent,
  };
}

async function sendAwaitedJob(runtime: NotifyRuntime, idempotencyKey: string, failureMessage: string): Promise<void> {
  await sendJob(idempotencyKey, sendDeps(runtime));
  const job = await getJob(runtime.sql, idempotencyKey);
  if (job?.status === "failed") {
    throw new NotifySendError(job.failure_reason ?? failureMessage);
  }
}

function resolvedEmail(profile: NotificationRecipientProfile): string | null {
  return profile.notificationEmail ?? profile.email ?? profile.fallbackEmail ?? null;
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
    idempotency_key: input.idempotencyKey,
    tenant: input.schoolId,
    job_kind: "school",
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
      idempotency_key: input.idempotencyKey,
      subject_id: subjectId,
      channel: "queued",
      status: "pending",
      provider_message_id: null,
      failure_reason: null,
    });
  }
  await sendJob(input.idempotencyKey, sendDeps(runtime));
}

export async function cancelSchoolNotification(
  runtime: NotifyRuntime,
  idempotencyKey: string,
  schoolId?: string,
): Promise<void> {
  await cancelJob(runtime.sql, idempotencyKey, schoolId);
}

export async function upsertSchoolRecipient(
  runtime: NotifyRuntime,
  profile: NotificationRecipientProfile,
): Promise<void> {
  if (!profile.recipient.subjectId) {
    return;
  }
  const allows = profile.preferences.allowsNotifications !== false;
  await upsertRecipient(runtime.sql, {
    subject_id: profile.recipient.subjectId,
    tenant: profile.schoolId,
    email: resolvedEmail(profile),
    display_name: profile.displayName ?? null,
    locale: profile.locale ?? null,
    allows_notifications: allows,
    channel_email: allows && (profile.preferences.channels?.email ?? true),
    channel_push: allows && (profile.preferences.channels?.push ?? false),
    recipient_kind: profile.recipient.kind,
    recipient_id: profile.recipient.id,
  });
}

export async function removeSchoolRecipient(
  runtime: NotifyRuntime,
  schoolId: string,
  recipient: NotificationRecipient,
): Promise<void> {
  if (!recipient.subjectId) {
    return;
  }
  await deleteRecipient(runtime.sql, recipient.subjectId, schoolId);
}

export async function registerSchoolPushDevice(
  runtime: NotifyRuntime,
  input: RegisterPushDeviceInput,
): Promise<void> {
  await upsertDevice(runtime.sql, {
    subject_id: input.subjectId,
    provider: input.provider,
    token: input.token,
  });
}

export async function unregisterSchoolPushDevice(
  runtime: NotifyRuntime,
  input: UnregisterPushDeviceInput,
): Promise<void> {
  await deleteDevice(runtime.sql, input.subjectId, input.provider);
}

export async function lookupSchoolDeliveryStatuses(
  runtime: NotifyRuntime,
  deliveries: ReadonlyArray<NotificationDeliveryStatusQuery>,
): Promise<Map<string, NotificationDeliveryStatusLookup>> {
  const result = new Map<string, NotificationDeliveryStatusLookup>();
  const rows = await lookupJobRecipients(runtime.sql, deliveries);
  for (const query of deliveries) {
    const matches = rows.filter(row =>
      row.idempotency_key === query.deliveryId && row.subject_id === query.subjectId && row.channel !== "queued",
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
  const subjectId = buildInvitationRecipientId(input.invitationId);
  const email = input.contactChannel === "email" ? input.contactValue : undefined;
  await upsertRecipient(runtime.sql, {
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
    idempotency_key: input.invitationId,
    tenant: input.schoolId,
    job_kind: "invitation",
    event_key: "account_invitation",
    title: input.emailSubject,
    body: input.emailBody,
    email_subject: input.emailSubject,
    email_body: input.emailBody,
    metadata: JSON.stringify({ inviteUrl: input.inviteUrl }),
  });
  await upsertJobRecipient(runtime.sql, {
    idempotency_key: input.invitationId,
    subject_id: subjectId,
    channel: "queued",
    status: "pending",
    provider_message_id: null,
    failure_reason: null,
  });
  await sendAwaitedJob(runtime, input.invitationId, "invitation send failed");
}

export async function revokeInvitation(runtime: NotifyRuntime, invitationId: string): Promise<void> {
  await cancelJob(runtime.sql, invitationId);
  await deleteRecipient(runtime.sql, buildInvitationRecipientId(invitationId));
}

export async function sendAuthOtp(runtime: NotifyRuntime, input: AuthOtpEmailInput): Promise<void> {
  const email = normalizeEmail(input.email);
  const subjectId = buildAuthRecipientId(email);
  const copy = formatOtpEmail(input);
  await upsertRecipient(runtime.sql, {
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
  const idempotencyKey = `auth-otp:${email}:${input.otp}:${Date.now()}`;
  await insertJobIfAbsent(runtime.sql, {
    idempotency_key: idempotencyKey,
    tenant: NOTIFY_PLATFORM_TENANT,
    job_kind: "auth_otp",
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
  await upsertRecipient(runtime.sql, {
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
  const idempotencyKey = `auth-verify:${email}:${Date.now()}`;
  await insertJobIfAbsent(runtime.sql, {
    idempotency_key: idempotencyKey,
    tenant: NOTIFY_PLATFORM_TENANT,
    job_kind: "auth_verification",
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
