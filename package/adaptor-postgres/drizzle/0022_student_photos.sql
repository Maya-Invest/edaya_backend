ALTER TABLE students ADD COLUMN photo_attachment_id text;
--> statement-breakpoint
UPDATE students
SET photo_attachment_id = (regexp_match(photo_url, '/core/files/([^/?#]+)/content'))[1]
WHERE photo_url IS NOT NULL
  AND photo_url ~ '/core/files/[^/?#]+/content';
--> statement-breakpoint
CREATE INDEX students_photo_attachment_id_idx ON students (photo_attachment_id);
--> statement-breakpoint
CREATE TABLE student_photo_submissions (
  id text PRIMARY KEY,
  school_id text NOT NULL,
  student_id text NOT NULL,
  attachment_id text NOT NULL,
  submitter_guardian_id text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL,
  reviewer_staff_id text,
  reviewed_at timestamp,
  rejection_reason text,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX student_photo_submissions_school_id_idx ON student_photo_submissions (school_id);
--> statement-breakpoint
CREATE INDEX student_photo_submissions_student_id_idx ON student_photo_submissions (student_id);
--> statement-breakpoint
CREATE INDEX student_photo_submissions_status_idx ON student_photo_submissions (school_id, status);
--> statement-breakpoint
CREATE UNIQUE INDEX student_photo_submissions_one_pending_uidx
  ON student_photo_submissions (school_id, student_id)
  WHERE status = 'pending';
--> statement-breakpoint
ALTER TABLE school_notification_templates
  ADD COLUMN student_photo_approved jsonb;
--> statement-breakpoint
ALTER TABLE school_notification_templates
  ADD COLUMN student_photo_rejected jsonb;
