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
  display_name: unknown;
  locale: unknown;
  allows_notifications: unknown;
  channel_email: unknown;
  channel_push: unknown;
  recipient_kind: unknown;
  recipient_id: unknown;
}

function mapRecipient(row: RecipientRecord): NotifyRecipientRow {
  return {
    subject_id: String(row.subject_id),
    tenant: String(row.tenant),
    email: row.email == null ? null : String(row.email),
    display_name: row.display_name == null ? null : String(row.display_name),
    locale: row.locale == null ? null : String(row.locale),
    allows_notifications: asBoolean(row.allows_notifications),
    channel_email: asBoolean(row.channel_email),
    channel_push: asBoolean(row.channel_push),
    recipient_kind: row.recipient_kind == null ? null : String(row.recipient_kind),
    recipient_id: row.recipient_id == null ? null : String(row.recipient_id),
  };
}

export async function upsertRecipient(
  sql: NotifySql,
  row: Omit<NotifyRecipientRow, "updated_at">,
): Promise<void> {
  await sql.execute(
    `INSERT INTO notify.recipients (
      subject_id, tenant, email, display_name, locale,
      allows_notifications, channel_email, channel_push, recipient_kind, recipient_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    ON CONFLICT (subject_id) DO UPDATE SET
      tenant = EXCLUDED.tenant,
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      locale = EXCLUDED.locale,
      allows_notifications = EXCLUDED.allows_notifications,
      channel_email = EXCLUDED.channel_email,
      channel_push = EXCLUDED.channel_push,
      recipient_kind = EXCLUDED.recipient_kind,
      recipient_id = EXCLUDED.recipient_id,
      updated_at = NOW()`,
    [
      row.subject_id,
      row.tenant,
      row.email,
      row.display_name,
      row.locale,
      row.allows_notifications,
      row.channel_email,
      row.channel_push,
      row.recipient_kind,
      row.recipient_id,
    ],
  );
}

export async function getRecipient(sql: NotifySql, subjectId: string): Promise<NotifyRecipientRow | undefined> {
  const rows = await sql.query<RecipientRecord>(
    "SELECT * FROM notify.recipients WHERE subject_id = $1",
    [subjectId],
  );
  const row = rows[0];
  return row ? mapRecipient(row) : undefined;
}

export async function deleteRecipient(sql: NotifySql, subjectId: string, tenant?: string): Promise<void> {
  await sql.execute("DELETE FROM notify.devices WHERE subject_id = $1", [subjectId]);
  if (tenant) {
    await sql.execute("DELETE FROM notify.recipients WHERE subject_id = $1 AND tenant = $2", [subjectId, tenant]);
    return;
  }
  await sql.execute("DELETE FROM notify.recipients WHERE subject_id = $1", [subjectId]);
}

export async function upsertDevice(
  sql: NotifySql,
  row: NotifyDeviceRow,
): Promise<void> {
  await sql.execute(
    `INSERT INTO notify.devices (subject_id, provider, token, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (subject_id, provider) DO UPDATE SET token = EXCLUDED.token, updated_at = NOW()`,
    [row.subject_id, row.provider, row.token],
  );
}

export async function deleteDevice(sql: NotifySql, subjectId: string, provider: string): Promise<void> {
  await sql.execute("DELETE FROM notify.devices WHERE subject_id = $1 AND provider = $2", [subjectId, provider]);
}

export async function listDevices(sql: NotifySql, subjectId: string): Promise<NotifyDeviceRow[]> {
  return sql.query<NotifyDeviceRow>(
    "SELECT subject_id, provider, token FROM notify.devices WHERE subject_id = $1",
    [subjectId],
  );
}

export async function insertJobIfAbsent(
  sql: NotifySql,
  job: Pick<NotifyJobRow, "idempotency_key" | "tenant" | "job_kind" | "event_key" | "title" | "body" | "email_subject" | "email_body" | "metadata">,
): Promise<{ created: boolean }> {
  const existing = await sql.query<{ idempotency_key: string }>(
    "SELECT idempotency_key FROM notify.jobs WHERE idempotency_key = $1",
    [job.idempotency_key],
  );
  if (existing[0]) {
    return { created: false };
  }
  await sql.execute(
    `INSERT INTO notify.jobs (
      idempotency_key, tenant, job_kind, event_key, title, body, email_subject, email_body, metadata, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
    [
      job.idempotency_key,
      job.tenant,
      job.job_kind,
      job.event_key,
      job.title,
      job.body,
      job.email_subject,
      job.email_body,
      job.metadata,
    ],
  );
  return { created: true };
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
  const job = await getJob(sql, idempotencyKey);
  if (!job) {
    return false;
  }
  if (tenant && job.tenant !== tenant) {
    return false;
  }
  if (job.status !== "pending") {
    return job.status === "cancelled";
  }
  await updateJobStatus(sql, idempotencyKey, "cancelled");
  return true;
}

export async function upsertJobRecipient(
  sql: NotifySql,
  row: NotifyJobRecipientRow,
): Promise<void> {
  await sql.execute(
    `INSERT INTO notify.job_recipients (idempotency_key, subject_id, channel, status, provider_message_id, failure_reason)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (idempotency_key, subject_id, channel) DO UPDATE SET
       status = EXCLUDED.status,
       provider_message_id = EXCLUDED.provider_message_id,
       failure_reason = EXCLUDED.failure_reason`,
    [row.idempotency_key, row.subject_id, row.channel, row.status, row.provider_message_id, row.failure_reason],
  );
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
  keys: ReadonlyArray<{ deliveryId: string; subjectId: string }>,
): Promise<NotifyJobRecipientRow[]> {
  if (keys.length === 0) {
    return [];
  }
  const results: NotifyJobRecipientRow[] = [];
  for (const key of keys) {
    const rows = await sql.query<NotifyJobRecipientRow>(
      "SELECT * FROM notify.job_recipients WHERE idempotency_key = $1 AND subject_id = $2",
      [key.deliveryId, key.subjectId],
    );
    results.push(...rows);
  }
  return results;
}
