ALTER TABLE class_subjects ADD COLUMN participation_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE student_subject_enrollments (
 id text PRIMARY KEY,
 student_class_enrollment_id text NOT NULL REFERENCES student_class_enrollments(id),
 class_subject_id text NOT NULL REFERENCES class_subjects(id),
 enrolled_at timestamp NOT NULL,
 ended_at timestamp,
 source text NOT NULL CHECK (source IN ('automatic', 'explicit')),
 scope text NOT NULL DEFAULT 'annual' CHECK (scope IN ('annual', 'periods')),
 periods jsonb NOT NULL DEFAULT '[]',
 deleted_at timestamp,
 deleted_by text,
 revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
 created_at timestamp NOT NULL,
 CHECK (ended_at IS NULL OR ended_at > enrolled_at)
);
--> statement-breakpoint
CREATE INDEX student_subject_enrollments_placement_idx ON student_subject_enrollments(student_class_enrollment_id);
--> statement-breakpoint
CREATE INDEX student_subject_enrollments_roster_idx ON student_subject_enrollments(class_subject_id, enrolled_at, ended_at) WHERE deleted_at IS NULL;
--> statement-breakpoint

--> statement-breakpoint
CREATE UNIQUE INDEX student_subject_enrollments_current_idx ON student_subject_enrollments(student_class_enrollment_id,class_subject_id) WHERE deleted_at IS NULL;
