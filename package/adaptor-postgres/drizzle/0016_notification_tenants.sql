-- Abort rather than attach orphan delivery history to a newly namespaced job.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM notify.job_recipients recipient LEFT JOIN notify.jobs job USING (idempotency_key) WHERE job.idempotency_key IS NULL) THEN
    RAISE EXCEPTION 'NOTIFY_ORPHAN_DELIVERY_HISTORY';
  END IF;
END $$;
--> statement-breakpoint
-- Delivery references retain the original application ID while transport keys
-- isolate identical logical requests in different schools and job kinds.
ALTER TABLE notify.jobs ADD COLUMN delivery_id text;
--> statement-breakpoint
UPDATE notify.jobs SET delivery_id = CASE WHEN job_kind IN ('auth_otp', 'auth_verification') THEN gen_random_uuid()::text ELSE idempotency_key END;
--> statement-breakpoint
ALTER TABLE notify.jobs ALTER COLUMN delivery_id SET NOT NULL;
--> statement-breakpoint
CREATE TEMP TABLE notification_job_key_migration ON COMMIT DROP AS
  SELECT idempotency_key AS old_key,
    'notify:' || '[' || to_json(job_kind)::text || ',' || to_json(tenant)::text || ',' || to_json(delivery_id)::text || ']' AS new_key
  FROM notify.jobs;
--> statement-breakpoint
ALTER TABLE notify.job_recipients DROP CONSTRAINT job_recipients_pkey;
--> statement-breakpoint
ALTER TABLE notify.jobs DROP CONSTRAINT jobs_pkey;
--> statement-breakpoint
UPDATE notify.job_recipients recipient SET idempotency_key = mapping.new_key
  FROM notification_job_key_migration mapping WHERE recipient.idempotency_key = mapping.old_key;
--> statement-breakpoint
UPDATE notify.jobs job SET idempotency_key = mapping.new_key
  FROM notification_job_key_migration mapping WHERE job.idempotency_key = mapping.old_key;
--> statement-breakpoint
ALTER TABLE notify.jobs ADD PRIMARY KEY (idempotency_key);
--> statement-breakpoint
ALTER TABLE notify.job_recipients ADD PRIMARY KEY (idempotency_key, subject_id, channel);
--> statement-breakpoint
ALTER TABLE notify.recipients DROP CONSTRAINT recipients_pkey;
--> statement-breakpoint
ALTER TABLE notify.recipients ADD PRIMARY KEY (tenant, subject_id);
--> statement-breakpoint
-- A legacy token has no trustworthy school provenance. Preserve it for bounded
-- cutover retention, but never use it for delivery until the client registers.
ALTER TABLE notify.devices RENAME TO devices_unscoped_legacy;
--> statement-breakpoint
CREATE TABLE notify.devices (
  tenant text NOT NULL,
  subject_id text NOT NULL,
  provider text NOT NULL,
  token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant, subject_id, provider)
);
--> statement-breakpoint
ALTER TABLE notify.jobs ADD COLUMN payload_version integer NOT NULL DEFAULT 1;
