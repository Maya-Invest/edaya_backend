ALTER TABLE assessments ADD COLUMN marks_status text NOT NULL DEFAULT 'draft';
--> statement-breakpoint
ALTER TABLE assessments ADD COLUMN marks_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE assessments ADD COLUMN marks_review jsonb NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE assessments ADD CONSTRAINT assessments_marks_status_check CHECK (marks_status IN ('draft', 'submitted', 'approved'));
--> statement-breakpoint
ALTER TABLE assessment_results ADD COLUMN designation text;
--> statement-breakpoint
ALTER TABLE assessment_results ADD CONSTRAINT assessment_results_designation_check CHECK (designation IS NULL OR (designation = 'scored' AND score IS NOT NULL) OR (designation IN ('absent', 'exempt') AND score IS NULL));
--> statement-breakpoint
CREATE UNIQUE INDEX assessment_results_assessment_student_uidx ON assessment_results (assessment_id, student_id);
--> statement-breakpoint
CREATE INDEX assessments_marks_review_idx ON assessments (marks_status, class_group_id, period_id);
--> statement-breakpoint
ALTER TABLE report_card_results ALTER COLUMN overall_average TYPE numeric(8,2) USING overall_average::numeric;
--> statement-breakpoint
ALTER TABLE report_card_results ALTER COLUMN pass_threshold TYPE numeric(8,2) USING pass_threshold::numeric;
--> statement-breakpoint
ALTER TABLE report_card_results ADD COLUMN version integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE report_card_results ADD COLUMN source_assessments jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE report_card_results ADD COLUMN pending_assessment_ids jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE report_card_results ADD COLUMN calculation_stale boolean NOT NULL DEFAULT false;
