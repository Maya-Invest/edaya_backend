CREATE TABLE "class_logbook_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"class_subject_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"chapter" text NOT NULL,
	"content" text NOT NULL,
	"objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"homework" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"progress" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
