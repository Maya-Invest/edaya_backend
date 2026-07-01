CREATE TABLE "activity_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"schedule_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"status" text NOT NULL,
	"is_exception" boolean NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"calendar_date" date NOT NULL,
	"display_label" text NOT NULL,
	"notes" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "activity_sessions_schedule_calendar_date_idx" ON "activity_sessions" ("schedule_id","calendar_date");
--> statement-breakpoint
CREATE INDEX "activity_sessions_class_group_id_idx" ON "activity_sessions" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "activity_sessions_school_id_idx" ON "activity_sessions" ("school_id");
