CREATE TABLE "extracurricular_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"coach" text NOT NULL,
	"schedule" text NOT NULL,
	"participants" integer NOT NULL,
	"capacity" integer NOT NULL,
	"description" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"student_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp NOT NULL
);
