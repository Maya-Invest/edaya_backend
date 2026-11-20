ALTER TABLE "school_notification_templates"
  ADD COLUMN "family_feedback_opened" jsonb,
  ADD COLUMN "family_feedback_reminder" jsonb,
  ADD COLUMN "family_feedback_published" jsonb,
  ADD COLUMN "family_feedback_purge_reminder" jsonb;
--> statement-breakpoint
CREATE TABLE "family_feedback_campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "academic_period_id" text NOT NULL,
  "class_group_id" text NOT NULL,
  "class_subject_id" text NOT NULL,
  "teacher_assignment_id" text NOT NULL,
  "teacher_id" text NOT NULL,
  "subject_id" text NOT NULL,
  "question_version" text NOT NULL,
  "status" text NOT NULL,
  "opens_at" timestamp,
  "closes_at" timestamp,
  "opened_at" timestamp,
  "closed_at" timestamp,
  "cancelled_at" timestamp,
  "published_at" timestamp,
  "archived_at" timestamp,
  "answers_purged_at" timestamp,
  "moderator_staff_id" text,
  "theme_draft" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "family_feedback_campaigns_school_id_idx" ON "family_feedback_campaigns" ("school_id");
--> statement-breakpoint
CREATE INDEX "family_feedback_campaigns_status_idx" ON "family_feedback_campaigns" ("school_id", "status");
--> statement-breakpoint
CREATE INDEX "family_feedback_campaigns_assignment_idx" ON "family_feedback_campaigns" ("school_id", "teacher_assignment_id", "academic_period_id");
--> statement-breakpoint
CREATE TABLE "family_feedback_slots" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "student_id" text NOT NULL,
  "teacher_assignment_id" text NOT NULL,
  "status" text NOT NULL,
  "completing_guardian_id" text,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "family_feedback_slots_identity_uidx" ON "family_feedback_slots" ("school_id", "campaign_id", "student_id", "teacher_assignment_id");
--> statement-breakpoint
CREATE INDEX "family_feedback_slots_campaign_idx" ON "family_feedback_slots" ("school_id", "campaign_id", "status");
--> statement-breakpoint
CREATE INDEX "family_feedback_slots_student_idx" ON "family_feedback_slots" ("school_id", "student_id");
--> statement-breakpoint
CREATE TABLE "family_feedback_responses" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "slot_id" text NOT NULL,
  "answers" jsonb NOT NULL,
  "comment" text,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "family_feedback_responses_slot_uidx" ON "family_feedback_responses" ("school_id", "slot_id");
--> statement-breakpoint
CREATE INDEX "family_feedback_responses_campaign_idx" ON "family_feedback_responses" ("school_id", "campaign_id");
--> statement-breakpoint
CREATE TABLE "family_feedback_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "published_at" timestamp NOT NULL,
  "published_by_staff_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "family_feedback_snapshots_campaign_uidx" ON "family_feedback_snapshots" ("school_id", "campaign_id");
--> statement-breakpoint
CREATE TABLE "family_feedback_comment_read_audit" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "actor_id" text NOT NULL,
  "actor_kind" text NOT NULL,
  "subject_id" text NOT NULL,
  "read_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "family_feedback_comment_read_audit_campaign_idx" ON "family_feedback_comment_read_audit" ("school_id", "campaign_id");
