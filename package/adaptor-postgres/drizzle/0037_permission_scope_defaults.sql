DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM staff_permission_profiles) OR EXISTS (SELECT 1 FROM staff_permission_assignments) THEN
    RAISE EXCEPTION 'Permission profile cutover requires a fresh school database. Reset and reseed before applying this migration.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE staff_permission_profiles DROP COLUMN scope_grain;
--> statement-breakpoint
ALTER TABLE staff_permission_profile_bindings RENAME COLUMN scopes TO custom_scopes;
--> statement-breakpoint
ALTER TABLE staff_permission_profile_bindings ADD COLUMN use_default_scopes boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE staff_permission_profile_bindings ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
DROP INDEX staff_permission_profile_bindings_staff_profile_uidx;
--> statement-breakpoint
CREATE UNIQUE INDEX staff_permission_profile_bindings_staff_profile_uidx ON staff_permission_profile_bindings (staff_id, profile_id, academic_year_id);
--> statement-breakpoint
ALTER TABLE staff_permission_assignments ADD COLUMN source_manual_assignment_id text;
--> statement-breakpoint
ALTER TABLE staff_permission_assignments ADD COLUMN source_profile_binding_id text;
--> statement-breakpoint
CREATE TABLE staff_permission_scope_defaults (
  id text PRIMARY KEY, school_id text NOT NULL, staff_id text NOT NULL, academic_year_id text NOT NULL,
  scopes jsonb NOT NULL, created_at timestamp NOT NULL, updated_at timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX staff_permission_scope_defaults_staff_year_uidx ON staff_permission_scope_defaults (school_id, staff_id, academic_year_id);
--> statement-breakpoint
CREATE TABLE staff_manual_permission_assignments (
  id text PRIMARY KEY, school_id text NOT NULL, staff_id text NOT NULL, academic_year_id text NOT NULL,
  permission text NOT NULL, custom_scopes jsonb NOT NULL, use_default_scopes boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active', starts_at timestamp, ends_at timestamp, warnings jsonb NOT NULL DEFAULT '[]',
  created_at timestamp NOT NULL, updated_at timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX staff_manual_permission_assignments_staff_year_idx ON staff_manual_permission_assignments (school_id, staff_id, academic_year_id);
--> statement-breakpoint
