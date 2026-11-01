CREATE SCHEMA IF NOT EXISTS notify;

CREATE TABLE IF NOT EXISTS notify.recipients (
  subject_id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  locale TEXT,
  allows_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  channel_email BOOLEAN NOT NULL DEFAULT TRUE,
  channel_push BOOLEAN NOT NULL DEFAULT FALSE,
  recipient_kind TEXT,
  recipient_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT command_notification_destination CHECK (
    ((tenant = 'platform' AND subject_id = 'auth:' || email AND recipient_id = email)
      OR subject_id = 'invite:' || recipient_id) IS TRUE
  )
);

CREATE TABLE IF NOT EXISTS notify.devices (
  subject_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (subject_id, provider)
);

CREATE TABLE IF NOT EXISTS notify.jobs (
  idempotency_key TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  job_kind TEXT NOT NULL,
  event_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  email_subject TEXT,
  email_body TEXT,
  metadata TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  lease_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notify.job_recipients (
  idempotency_key TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  failure_reason TEXT,
  PRIMARY KEY (idempotency_key, subject_id, channel)
);
