CREATE TABLE IF NOT EXISTS "teachers" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "photo_url" text,
  "email" text,
  "phone" text,
  "notification_email" text,
  "notification_phone" text,
  "subject_id" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teacher_assignments" (
  "id" text PRIMARY KEY NOT NULL,
  "teacher_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "kind" text NOT NULL,
  "class_subject_id" text,
  "class_group_id" text,
  "responsibility" text,
  "status" text DEFAULT 'active' NOT NULL,
  "starts_at" timestamp,
  "ends_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp
);
