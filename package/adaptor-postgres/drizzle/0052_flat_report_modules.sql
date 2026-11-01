DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM report_card_definitions)
     OR EXISTS (SELECT 1 FROM report_card_definition_sections)
     OR EXISTS (SELECT 1 FROM report_card_results) THEN
    RAISE EXCEPTION 'Flat report modules require an empty school database. Back up and reset local/test data before applying this cutover. Hosted resets require a separate rollout.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE report_modules (
  id text PRIMARY KEY,
  school_id text NOT NULL,
  grade_level_id text NOT NULL,
  academic_year_id text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  order_val integer NOT NULL CHECK (order_val > 0),
  weighting_mode text NOT NULL CHECK (weighting_mode IN ('subject_coefficients', 'explicit')),
  explicit_weight double precision,
  created_at timestamp NOT NULL,
  CONSTRAINT report_module_weight_valid CHECK (
    (weighting_mode = 'subject_coefficients' AND explicit_weight IS NULL)
    OR (weighting_mode = 'explicit' AND explicit_weight IS NOT NULL AND explicit_weight > 0 AND explicit_weight < 'Infinity'::double precision)
  )
);
--> statement-breakpoint
CREATE INDEX report_modules_scope_idx ON report_modules (school_id, grade_level_id, academic_year_id);
--> statement-breakpoint
ALTER TABLE subjects ADD COLUMN report_module_id text REFERENCES report_modules(id) ON DELETE SET NULL,
  ADD COLUMN report_order integer NOT NULL DEFAULT 0 CHECK (report_order >= 0);
--> statement-breakpoint
ALTER TABLE grade_levels ADD COLUMN report_settings jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE report_card_results DROP COLUMN report_card_definition_id,
  ADD COLUMN grade_level_id text NOT NULL,
  ADD COLUMN academic_year_id text NOT NULL,
  ADD COLUMN report_configuration_revision integer NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX report_card_results_student_period_unique ON report_card_results (student_id, period_id);
--> statement-breakpoint
DROP TABLE report_card_definition_sections;
--> statement-breakpoint
DROP TABLE report_card_definitions;
