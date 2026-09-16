ALTER TABLE "staff_permission_assignments" ADD COLUMN "source_profile_id" text;
--> statement-breakpoint
CREATE INDEX "staff_permission_assignments_source_profile_id_idx" ON "staff_permission_assignments" ("source_profile_id");
--> statement-breakpoint
CREATE TABLE "staff_permission_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "scope_grain" text NOT NULL,
  "permissions" jsonb NOT NULL,
  "source_key" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "staff_permission_profiles_school_id_idx" ON "staff_permission_profiles" ("school_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_permission_profiles_source_key_uidx" ON "staff_permission_profiles" ("school_id", "source_key") WHERE "source_key" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "staff_permission_profile_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "staff_id" text NOT NULL,
  "profile_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "scopes" jsonb NOT NULL,
  "sort_order" integer NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "staff_permission_profile_bindings_school_id_idx" ON "staff_permission_profile_bindings" ("school_id");
--> statement-breakpoint
CREATE INDEX "staff_permission_profile_bindings_staff_id_idx" ON "staff_permission_profile_bindings" ("staff_id");
--> statement-breakpoint
CREATE INDEX "staff_permission_profile_bindings_profile_id_idx" ON "staff_permission_profile_bindings" ("profile_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_permission_profile_bindings_staff_profile_uidx" ON "staff_permission_profile_bindings" ("staff_id", "profile_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_permission_profile_bindings_sort_uidx" ON "staff_permission_profile_bindings" ("staff_id", "academic_year_id", "sort_order");
--> statement-breakpoint
ALTER TABLE "staff_permission_profile_bindings"
  ADD CONSTRAINT "staff_permission_profile_bindings_profile_fk"
  FOREIGN KEY ("profile_id") REFERENCES "staff_permission_profiles"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "staff_permission_assignments"
  ADD CONSTRAINT "staff_permission_assignments_source_profile_fk"
  FOREIGN KEY ("source_profile_id") REFERENCES "staff_permission_profiles"("id") ON DELETE SET NULL;
