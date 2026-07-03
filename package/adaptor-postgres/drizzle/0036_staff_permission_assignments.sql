CREATE TABLE IF NOT EXISTS "staff_permission_assignments" (
  "id" text PRIMARY KEY NOT NULL,
  "staff_id" text NOT NULL,
  "school_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "permission" text NOT NULL,
  "scope_ids" text DEFAULT '' NOT NULL,
  "status" text NOT NULL,
  "starts_at" timestamp,
  "ends_at" timestamp,
  "source_staff_assignment_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
