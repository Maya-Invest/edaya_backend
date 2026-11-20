ALTER TABLE assessment_results ADD COLUMN revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE report_card_results ADD COLUMN source_marks jsonb NOT NULL DEFAULT '[]', ADD COLUMN pending_correction_ids jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
CREATE TABLE assessment_marks_corrections (
 id text PRIMARY KEY,
 school_id text NOT NULL REFERENCES schools(id),
 assessment_id text NOT NULL REFERENCES assessments(id),
 status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
 version integer NOT NULL CHECK (version >= 0),
 payload jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX assessment_marks_corrections_pending ON assessment_marks_corrections(assessment_id) WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX assessment_marks_corrections_school_status ON assessment_marks_corrections(school_id, status, id);
--> statement-breakpoint
CREATE INDEX report_card_source_marks ON report_card_results USING gin(source_marks) WHERE status = 'published';
--> statement-breakpoint
ALTER TABLE assessments DROP CONSTRAINT assessments_marks_status_check;
--> statement-breakpoint
ALTER TABLE assessments ADD CONSTRAINT assessments_marks_status_check CHECK (marks_status IN ('draft', 'submitted'));
