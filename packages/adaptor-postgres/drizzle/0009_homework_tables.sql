CREATE TABLE "homework_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"class_subject_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_date" timestamp NOT NULL,
	"assigned_date" timestamp NOT NULL,
	"type" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"homework_assignment_id" text NOT NULL,
	"student_id" text NOT NULL,
	"status" text NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp NOT NULL
);
