-- Additive rollout: existing scores, closed intervals and published outputs are untouched.
ALTER TABLE grade_levels ADD COLUMN grading_policies jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE grade_scales
  ALTER COLUMN min_score TYPE numeric,
  ALTER COLUMN max_score TYPE numeric,
  ADD COLUMN rounding_mode text NOT NULL DEFAULT 'nearest',
  ADD COLUMN interval_convention text NOT NULL DEFAULT 'legacy-closed',
  ADD COLUMN revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE assessment_results
  ADD COLUMN mention_id text,
  ADD COLUMN original_entry jsonb,
  ADD COLUMN calculation jsonb;
--> statement-breakpoint
ALTER TABLE report_card_results
  ALTER COLUMN overall_average TYPE numeric,
  ADD COLUMN grading jsonb,
  ADD COLUMN aggregate_label text,
  ADD COLUMN grading_policy_revision integer,
  ADD COLUMN revised_draft jsonb,
  ADD COLUMN publication_history jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
CREATE INDEX grading_classes_by_level_year ON class_groups (school_id, grade_level_id, academic_year_id, id);
--> statement-breakpoint
CREATE INDEX grading_marks_by_assessment ON assessment_results (assessment_id, id);
--> statement-breakpoint
CREATE INDEX grading_reports_by_class ON report_card_results (class_group_id, id);
--> statement-breakpoint
ALTER TABLE assessment_results DROP CONSTRAINT assessment_results_designation_check;
--> statement-breakpoint
ALTER TABLE assessment_results ADD CONSTRAINT assessment_results_designation_check CHECK (
  designation IS NULL OR
  (designation = 'scored' AND ((score IS NOT NULL AND mention_id IS NULL) OR (score IS NULL AND mention_id IS NOT NULL))) OR
  (designation IN ('absent', 'exempt') AND score IS NULL AND mention_id IS NULL)
);

--> statement-breakpoint
ALTER TABLE assessment_results ALTER COLUMN score TYPE numeric;
