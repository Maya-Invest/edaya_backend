DROP INDEX assessment_marks_corrections_pending;
--> statement-breakpoint
CREATE TABLE teacher_corrections (
 id text PRIMARY KEY,
 school_id text NOT NULL REFERENCES schools(id),
 class_group_id text NOT NULL REFERENCES class_groups(id),
 workflow text NOT NULL CHECK (workflow IN ('attendance','report_comments','logbook','discipline')),
 target_id text NOT NULL,
 status text NOT NULL CHECK (status IN ('pending','approved','rejected','withdrawn')),
 created_at timestamp with time zone NOT NULL,
 payload jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX teacher_corrections_pending ON teacher_corrections(school_id,workflow,target_id) WHERE status='pending';
--> statement-breakpoint
CREATE INDEX teacher_corrections_queue ON teacher_corrections(school_id,workflow,status,created_at,id);
--> statement-breakpoint
CREATE TABLE teacher_workflow_states (
 school_id text NOT NULL REFERENCES schools(id),
 workflow text NOT NULL,
 target_id text NOT NULL,
 payload jsonb NOT NULL,
 PRIMARY KEY (school_id,workflow,target_id)
);
