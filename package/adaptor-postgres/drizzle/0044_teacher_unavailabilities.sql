CREATE TABLE IF NOT EXISTS "teacher_unavailabilities" (
  "id" text PRIMARY KEY NOT NULL,
  "teacher_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "recurrence" text NOT NULL,
  "day_of_week" text,
  "start_time" text,
  "end_time" text,
  "effective_from" timestamp,
  "effective_until" timestamp,
  "starts_at" timestamp,
  "ends_at" timestamp,
  "reason" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teacher_unavailabilities_teacher_id_idx" ON "teacher_unavailabilities" ("teacher_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teacher_unavailabilities_academic_year_id_idx" ON "teacher_unavailabilities" ("academic_year_id");
