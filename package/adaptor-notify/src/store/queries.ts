import type {
  NotifyDeviceRow,
  NotifyJobRecipientRow,
  NotifyJobRow,
  NotifyRecipientRow,
  NotifySql,
} from "./types";

function asBoolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

interface RecipientRecord {
  subject_id: unknown;
  tenant: unknown;
  email: unknown;
  phone: unknown;
  display_name: unknown;
  locale: unknown;
  allows_notifications: unknown;
  channel_email: unknown;
  channel_push: unknown;
  channel_sms: unknown;
  recipient_kind: unknown;
  recipient_id: unknown;
}

function mapRecipient(row: RecipientRecord): NotifyRecipientRow {
  return {
    subject_id: String(row.subject_id),
    tenant: String(row.tenant),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    display_name: row.display_name == null ? null : String(row.display_name),
    locale: row.locale == null ? null : String(row.locale),
    allows_notifications: asBoolean(row.allows_notifications),
    channel_email: asBoolean(row.channel_email),
    channel_push: asBoolean(row.channel_push),
    channel_sms: asBoolean(row.channel_sms),
    recipient_kind: row.recipient_kind == null ? null : String(row.recipient_kind),
    recipient_id: row.recipient_id == null ? null : String(row.recipient_id),
  };
}

export async function upsertCommandRecipient(
  sql: NotifySql,
  row: Omit<NotifyRecipientRow, "updated_at">,
): Promise<void> {
  await sql.execute(
    `INSERT INTO notify.recipients (
      subject_id, tenant, email, phone, display_name, locale,
      allows_notifications, channel_email, channel_push, channel_sms, recipient_kind, recipient_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
    ON CONFLICT (tenant, subject_id) DO UPDATE SET
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      display_name = EXCLUDED.display_name,
      locale = EXCLUDED.locale,
      allows_notifications = EXCLUDED.allows_notifications,
      channel_email = EXCLUDED.channel_email,
      channel_push = EXCLUDED.channel_push,
      channel_sms = EXCLUDED.channel_sms,
      recipient_kind = EXCLUDED.recipient_kind,
      recipient_id = EXCLUDED.recipient_id,
      updated_at = NOW()`,
    [
      row.subject_id,
      row.tenant,
      row.email,
      row.phone,
      row.display_name,
      row.locale,
      row.allows_notifications,
      row.channel_email,
      row.channel_push,
      row.channel_sms,
      row.recipient_kind,
      row.recipient_id,
    ],
  );
}

export async function getCommandRecipient(sql: NotifySql, subjectId: string, tenant: string): Promise<NotifyRecipientRow | undefined> {
  const rows = await sql.query<RecipientRecord>(
    "SELECT * FROM notify.recipients WHERE subject_id = $1 AND tenant = $2",
    [subjectId, tenant],
  );
  const row = rows[0];
  return row ? mapRecipient(row) : undefined;
}

export async function deleteCommandRecipient(sql: NotifySql, subjectId: string, tenant: string): Promise<void> {
  await sql.execute("DELETE FROM notify.recipients WHERE subject_id = $1 AND tenant = $2", [subjectId, tenant]);
}

export async function upsertDevice(
  sql: NotifySql,
  row: NotifyDeviceRow,
): Promise<void> {
  await sql.execute(
    `INSERT INTO notify.devices (subject_id, provider, token, tenant, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (tenant, subject_id, provider) DO UPDATE SET token = EXCLUDED.token, updated_at = NOW()`,
    [row.subject_id, row.provider, row.token, row.tenant],
  );
}

export async function deleteDevice(sql: NotifySql, subjectId: string, provider: string, tenant: string): Promise<void> {
  await sql.execute("DELETE FROM notify.devices WHERE subject_id = $1 AND provider = $2 AND tenant = $3", [subjectId, provider, tenant]);
}

export async function listDevices(sql: NotifySql, subjectId: string, tenant: string): Promise<NotifyDeviceRow[]> {
  return sql.query<NotifyDeviceRow>(
    "SELECT tenant, subject_id, provider, token FROM notify.devices WHERE subject_id = $1 AND tenant = $2",
    [subjectId, tenant],
  );
}

export async function insertJobIfAbsent(
  sql: NotifySql,
  job: Pick<NotifyJobRow, "delivery_id" | "idempotency_key" | "tenant" | "job_kind" | "event_key" | "title" | "body" | "email_subject" | "email_body" | "sms_body" | "metadata">,
): Promise<{ created: boolean }> {
  const inserted = await sql.query<{ idempotency_key: string }>(
    `INSERT INTO notify.jobs (
      idempotency_key, tenant, job_kind, event_key, title, body, email_subject, email_body, sms_body, metadata, delivery_id, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
    ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
    [
      job.idempotency_key,
      job.tenant,
      job.job_kind,
      job.event_key,
      job.title,
      job.body,
      job.email_subject,
      job.email_body,
      job.sms_body,
      job.metadata,
      job.delivery_id,
    ],
  );
  return { created: inserted.length === 1 };
}

export async function getJob(sql: NotifySql, idempotencyKey: string): Promise<NotifyJobRow | undefined> {
  const rows = await sql.query<NotifyJobRow>(
    "SELECT * FROM notify.jobs WHERE idempotency_key = $1",
    [idempotencyKey],
  );
  return rows[0];
}

export async function updateJobStatus(
  sql: NotifySql,
  idempotencyKey: string,
  status: string,
  extras: { providerMessageId?: string; failureReason?: string } = {},
): Promise<void> {
  await sql.execute(
    `UPDATE notify.jobs SET status = $2, provider_message_id = COALESCE($3, provider_message_id),
      failure_reason = $4, updated_at = NOW() WHERE idempotency_key = $1`,
    [idempotencyKey, status, extras.providerMessageId ?? null, extras.failureReason ?? null],
  );
}

export async function cancelJob(sql: NotifySql, idempotencyKey: string, tenant?: string): Promise<boolean> {
  const rows = await sql.query<{ idempotency_key: string }>(`
    UPDATE notify.jobs SET status = 'cancelled', lease_id = NULL, lease_expires_at = NULL,
      next_attempt_at = NULL, updated_at = clock_timestamp()
    WHERE idempotency_key = $1 AND ($2::text IS NULL OR tenant = $2)
      AND status IN ('pending', 'failed', 'sending', 'cancelled') RETURNING idempotency_key`, [idempotencyKey, tenant ?? null]);
  return rows.length === 1;
}

export async function upsertJobRecipient(
  sql: NotifySql,
  row: NotifyJobRecipientRow,
  leaseId?: string,
): Promise<boolean> {
  const written = await sql.query<{ idempotency_key: string }>(
    `INSERT INTO notify.job_recipients (idempotency_key, subject_id, channel, status, provider_message_id, failure_reason)
     SELECT $1,$2,$3,$4,$5,$6 WHERE $7::text IS NULL OR EXISTS (
       SELECT 1 FROM notify.jobs WHERE idempotency_key = $1 AND lease_id = $7 AND status = 'sending' AND lease_expires_at > clock_timestamp()
     )
     ON CONFLICT (idempotency_key, subject_id, channel) DO UPDATE SET
       status = EXCLUDED.status,
       provider_message_id = EXCLUDED.provider_message_id,
       failure_reason = EXCLUDED.failure_reason RETURNING idempotency_key`,
    [row.idempotency_key, row.subject_id, row.channel, row.status, row.provider_message_id, row.failure_reason, leaseId ?? null],
  );
  return written.length > 0;
}

export async function listJobRecipients(
  sql: NotifySql,
  idempotencyKey: string,
): Promise<NotifyJobRecipientRow[]> {
  return sql.query<NotifyJobRecipientRow>(
    "SELECT * FROM notify.job_recipients WHERE idempotency_key = $1",
    [idempotencyKey],
  );
}

export async function lookupJobRecipients(
  sql: NotifySql,
  keys: ReadonlyArray<{ deliveryId: string; subjectId: string; schoolId: string }>,
): Promise<NotifyJobRecipientRow[]> {
  if (keys.length === 0) {
    return [];
  }
  const results: NotifyJobRecipientRow[] = [];
  for (const key of keys) {
    const rows = await sql.query<NotifyJobRecipientRow>(
      "SELECT recipient.* FROM notify.job_recipients recipient JOIN notify.jobs job USING (idempotency_key) WHERE job.delivery_id = $1 AND recipient.subject_id = $2 AND job.tenant = $3 AND job.job_kind = 'school'",
      [key.deliveryId, key.subjectId, key.schoolId],
    );
    results.push(...rows);
  }
  return results;
}
