CREATE TABLE "cron_job_schedules" (
  "id" text PRIMARY KEY NOT NULL,
  "job_key" text NOT NULL,
  "cron_expression" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "next_run_at" timestamp NOT NULL,
  "last_dispatched_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cron_job_schedules_job_key_idx" ON "cron_job_schedules" ("job_key");
--> statement-breakpoint
CREATE INDEX "cron_job_schedules_due_idx" ON "cron_job_schedules" ("enabled", "next_run_at");
--> statement-breakpoint
INSERT INTO "cron_job_schedules" (
  "id",
  "job_key",
  "cron_expression",
  "enabled",
  "next_run_at",
  "created_at",
  "updated_at"
) VALUES
  (
    'cron-schedule-expire-account-invitations',
    'expireAccountInvitations',
    '0 2 * * *',
    true,
    TIMESTAMP '1970-01-01 00:00:00',
    NOW(),
    NOW()
  ),
  (
    'cron-schedule-process-due-notifications',
    'processDueNotifications',
    '0 6 * * *',
    true,
    TIMESTAMP '1970-01-01 00:00:00',
    NOW(),
    NOW()
  ),
  (
    'cron-schedule-reconcile-pending-deliveries',
    'reconcilePendingDeliveries',
    '*/5 * * * *',
    true,
    TIMESTAMP '1970-01-01 00:00:00',
    NOW(),
    NOW()
  );
