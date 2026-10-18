DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM subjects) OR EXISTS (SELECT 1 FROM grade_level_subjects)
     OR EXISTS (SELECT 1 FROM class_subjects) OR EXISTS (SELECT 1 FROM subject_matters)
     OR EXISTS (SELECT 1 FROM staff_permission_assignments)
     OR EXISTS (SELECT 1 FROM staff_permission_scope_defaults)
     OR EXISTS (SELECT 1 FROM staff_permission_profile_bindings)
     OR EXISTS (SELECT 1 FROM staff_manual_permission_assignments) THEN
    RAISE EXCEPTION 'Grade/year subject cutover requires a fresh school database. Reset and reseed before applying this migration.';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE grade_level_subject_matters;
--> statement-breakpoint
DROP TABLE grade_level_subjects;
--> statement-breakpoint
ALTER TABLE subjects DROP COLUMN default_coefficient;
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN grade_level_id text NOT NULL;
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN academic_year_id text NOT NULL;
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN coefficient double precision;
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN periods_per_week integer;
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN min_period_span integer;
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN max_period_span integer;
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN is_optional boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE class_subjects DROP COLUMN grade_level_subject_id;
--> statement-breakpoint
ALTER TABLE class_subjects ALTER COLUMN coefficient TYPE double precision;
--> statement-breakpoint
CREATE UNIQUE INDEX class_subjects_class_subject_uidx ON class_subjects (class_group_id, subject_id);
--> statement-breakpoint
CREATE INDEX subjects_grade_year_idx ON subjects (grade_level_id, academic_year_id);
