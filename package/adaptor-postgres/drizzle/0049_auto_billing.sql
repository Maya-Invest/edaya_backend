-- Existing mandatory/optional fees remain manual until explicitly configured.
ALTER TABLE catalog_services ADD COLUMN auto_billing jsonb NOT NULL DEFAULT '{"mode":"off"}'::jsonb;
--> statement-breakpoint
ALTER TABLE catalog_services DROP COLUMN enrollment_mode;
--> statement-breakpoint
ALTER TABLE student_service_enrollments ADD COLUMN automation jsonb;
--> statement-breakpoint
CREATE TABLE auto_billing_runs (
  id text PRIMARY KEY,
  school_id text NOT NULL,
  catalog_service_id text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX auto_billing_runs_fee_status_idx ON auto_billing_runs (school_id, catalog_service_id, status, created_at DESC);
