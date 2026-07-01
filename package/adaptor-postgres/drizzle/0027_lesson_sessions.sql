ALTER TABLE "schools" ADD COLUMN "enforce_schedule_conflicts" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "school_id" text;
--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "schedule_kind" text DEFAULT 'lesson' NOT NULL;
--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "activity_id" text;
--> statement-breakpoint
UPDATE "schedules" AS s
SET "school_id" = cg."school_id"
FROM "class_groups" AS cg
WHERE s."class_group_id" = cg."id" AND s."school_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "schedules" ALTER COLUMN "school_id" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE "lesson_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"schedule_id" text NOT NULL,
	"class_subject_id" text NOT NULL,
	"status" text NOT NULL,
	"is_exception" boolean NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"calendar_date" date NOT NULL,
	"display_label" text NOT NULL,
	"session_note" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_sessions_schedule_calendar_date_idx" ON "lesson_sessions" ("schedule_id","calendar_date");
--> statement-breakpoint
CREATE INDEX "lesson_sessions_class_group_id_idx" ON "lesson_sessions" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "lesson_sessions_school_id_idx" ON "lesson_sessions" ("school_id");
