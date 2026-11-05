-- Coordinated fresh-school cutover. Never infer identities from existing display text.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM students) OR
    EXISTS (SELECT 1 FROM teachers) OR
    EXISTS (SELECT 1 FROM guardians) OR
    EXISTS (SELECT 1 FROM staff_members) OR
    EXISTS (SELECT 1 FROM schools) OR
    EXISTS (SELECT 1 FROM academic_years) OR
    EXISTS (SELECT 1 FROM academic_periods) OR
    EXISTS (SELECT 1 FROM grade_levels) OR
    EXISTS (SELECT 1 FROM period_definitions) OR
    EXISTS (SELECT 1 FROM subject_categories) OR
    EXISTS (SELECT 1 FROM subjects) OR
    EXISTS (SELECT 1 FROM subject_matters) OR
    EXISTS (SELECT 1 FROM class_groups) OR
    EXISTS (SELECT 1 FROM activities) OR
    EXISTS (SELECT 1 FROM grade_scales) OR
    EXISTS (SELECT 1 FROM report_modules) OR
    EXISTS (SELECT 1 FROM catalog_services) OR
    EXISTS (SELECT 1 FROM disciplinary_actions) OR
    EXISTS (SELECT 1 FROM resources) OR
    EXISTS (SELECT 1 FROM staff_permission_profiles) OR
    EXISTS (SELECT 1 FROM academic_disciplines) OR
    EXISTS (SELECT 1 FROM placement_statuses) THEN
    RAISE EXCEPTION 'Visible identification requires a clean school database; back up and reset local school data before applying this cutover';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE students RENAME COLUMN matricule TO identifier;
--> statement-breakpoint
ALTER TABLE students RENAME COLUMN national_matricule TO global_identifier;
--> statement-breakpoint
ALTER TABLE teachers RENAME COLUMN code TO identifier;
--> statement-breakpoint
ALTER INDEX teachers_school_code_uidx RENAME TO teachers_school_identifier_uidx;
--> statement-breakpoint
ALTER TABLE guardians RENAME COLUMN code TO identifier;
--> statement-breakpoint
ALTER INDEX guardians_school_code_uidx RENAME TO guardians_school_identifier_uidx;
--> statement-breakpoint
ALTER TABLE staff_members RENAME COLUMN code TO identifier;
--> statement-breakpoint
ALTER INDEX staff_members_school_code_uidx RENAME TO staff_members_school_identifier_uidx;
--> statement-breakpoint
ALTER TABLE grade_levels RENAME COLUMN label TO short_name;
--> statement-breakpoint
ALTER TABLE period_definitions RENAME COLUMN label TO name;
--> statement-breakpoint
ALTER TABLE placement_statuses RENAME COLUMN label TO name;
--> statement-breakpoint
DROP INDEX IF EXISTS subject_categories_school_name_uidx;
--> statement-breakpoint
DROP INDEX IF EXISTS academic_disciplines_school_code_unique;
--> statement-breakpoint
DROP INDEX IF EXISTS placement_statuses_school_code_unique;
--> statement-breakpoint
ALTER TABLE academic_disciplines DROP COLUMN code;
--> statement-breakpoint
ALTER TABLE placement_statuses DROP COLUMN code;
--> statement-breakpoint
ALTER TABLE subjects DROP COLUMN code;
--> statement-breakpoint
ALTER TABLE academic_years ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE academic_periods ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE period_definitions ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE subject_categories ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE subject_matters ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE class_groups ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE activities ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE grade_scales ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE report_modules ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE catalog_services ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE disciplinary_actions ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE resources ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE staff_permission_profiles ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE academic_disciplines ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE placement_statuses ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE students ADD CONSTRAINT students_identifier_format CHECK (identifier IS NULL OR (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'));
--> statement-breakpoint
ALTER TABLE teachers ADD CONSTRAINT teachers_identifier_format CHECK (identifier IS NULL OR (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'));
--> statement-breakpoint
ALTER TABLE guardians ADD CONSTRAINT guardians_identifier_format CHECK (identifier IS NULL OR (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'));
--> statement-breakpoint
ALTER TABLE staff_members ADD CONSTRAINT staff_members_identifier_format CHECK (identifier IS NULL OR (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'));
--> statement-breakpoint
CREATE UNIQUE INDEX students_school_identifier_uidx ON students (school_id, identifier);

--> statement-breakpoint
ALTER TABLE staff_members ADD COLUMN name text, ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE students ALTER COLUMN identifier SET NOT NULL;
--> statement-breakpoint
ALTER TABLE teachers ALTER COLUMN identifier SET NOT NULL;
--> statement-breakpoint
ALTER TABLE guardians ALTER COLUMN identifier SET NOT NULL;
--> statement-breakpoint
ALTER TABLE staff_members ADD CONSTRAINT staff_visible_identity CHECK ((account_kind = 'human' AND identifier IS NOT NULL) OR (account_kind = 'service' AND identifier IS NULL AND name IS NOT NULL AND short_name IS NOT NULL));
--> statement-breakpoint
ALTER TABLE schools ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE grade_levels ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE academic_years ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE academic_periods ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE period_definitions ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE subject_categories ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE subjects ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE subject_matters ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE class_groups ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE activities ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE grade_scales ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE report_modules ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE catalog_services ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE disciplinary_actions ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE resources ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE staff_permission_profiles ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE academic_disciplines ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE placement_statuses ALTER COLUMN short_name SET NOT NULL;
