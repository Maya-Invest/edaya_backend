CREATE TABLE "attendances" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"display_label" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attendances_class_group_id_idx" ON "attendances" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "attendances_school_id_idx" ON "attendances" ("school_id");
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "attendance_id" text;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "lesson_session_id" text;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "activity_session_id" text;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "assessment_id" text;
--> statement-breakpoint
ALTER TABLE "attendance_records" DROP COLUMN "session_id";
--> statement-breakpoint
ALTER TABLE "class_subject_progress" RENAME COLUMN "session_id" TO "lesson_session_id";
--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD COLUMN "lesson_session_id" text;
--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD COLUMN "activity_session_id" text;
--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD COLUMN "assessment_id" text;
--> statement-breakpoint
ALTER TABLE "staff_assignments" DROP COLUMN "session_id";
--> statement-breakpoint
ALTER TABLE "resource_assignments" ADD COLUMN "lesson_session_id" text;
--> statement-breakpoint
ALTER TABLE "resource_assignments" ADD COLUMN "activity_session_id" text;
--> statement-breakpoint
ALTER TABLE "resource_assignments" ADD COLUMN "assessment_id" text;
--> statement-breakpoint
ALTER TABLE "resource_assignments" DROP COLUMN "session_id";
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "lesson_session_id" text;
--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN "session_id";
--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "lesson_session_id" text;
--> statement-breakpoint
ALTER TABLE "incidents" DROP COLUMN "session_id";
--> statement-breakpoint
DROP TABLE "sessions";
