ALTER TABLE teacher_corrections DROP CONSTRAINT teacher_corrections_status_check;
--> statement-breakpoint
ALTER TABLE teacher_corrections ADD CONSTRAINT teacher_corrections_status_check CHECK (
 status IN ('pending','approved','rejected','withdrawn')
 OR (workflow = 'report_comments' AND status IN ('approved_pending_publication','published'))
);
--> statement-breakpoint
DROP INDEX teacher_corrections_pending;
--> statement-breakpoint
CREATE UNIQUE INDEX teacher_corrections_pending ON teacher_corrections(school_id,workflow,target_id)
 WHERE status IN ('pending','approved_pending_publication');
