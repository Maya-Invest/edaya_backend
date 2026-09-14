export interface NotifySql {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  execute: (sql: string, params?: unknown[]) => Promise<void>;
  close: () => Promise<void>;
}

export interface NotifyRecipientRow {
  subject_id: string;
  tenant: string;
  email: string | null;
  display_name: string | null;
  locale: string | null;
  allows_notifications: boolean;
  channel_email: boolean;
  channel_push: boolean;
  recipient_kind: string | null;
  recipient_id: string | null;
}

export interface NotifyDeviceRow {
  tenant: string;
  subject_id: string;
  provider: string;
  token: string;
}

export interface NotifyJobRow {
  payload_version: number;
  attempts: number;
  delivery_id: string;
  idempotency_key: string;
  tenant: string;
  job_kind: string;
  event_key: string;
  title: string;
  body: string;
  email_subject: string | null;
  email_body: string | null;
  metadata: string | null;
  status: string;
  provider_message_id: string | null;
  failure_reason: string | null;
  updated_at: Date | string;
}

export interface NotifyJobRecipientRow {
  idempotency_key: string;
  subject_id: string;
  channel: string;
  status: string;
  provider_message_id: string | null;
  failure_reason: string | null;
}
