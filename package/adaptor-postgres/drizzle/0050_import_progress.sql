ALTER TABLE school_import_batches ADD COLUMN counts jsonb NOT NULL DEFAULT '{}', ADD COLUMN progress_version integer NOT NULL DEFAULT 0, ADD COLUMN progress_at timestamptz;
--> statement-breakpoint
ALTER TABLE school_import_rows ADD COLUMN outcome text GENERATED ALWAYS AS (data->>'outcome') STORED, ADD COLUMN execution_rank integer NOT NULL DEFAULT 0, ADD COLUMN class_group_id text GENERATED ALWAYS AS (data->'proposed'->>'classGroupId') STORED;
--> statement-breakpoint
UPDATE school_import_rows SET execution_rank = CASE data->>'type' WHEN 'academic_disciplines' THEN 0 WHEN 'placement_statuses' THEN 0 WHEN 'classes' THEN 1 WHEN 'subjects' THEN 2 WHEN 'students' THEN 3 WHEN 'teachers' THEN 3 WHEN 'staff' THEN 3 WHEN 'guardians' THEN 4 WHEN 'class_offerings' THEN 4 WHEN 'chapters' THEN 4 WHEN 'guardian_contacts' THEN 5 WHEN 'guardian_relationships' THEN 5 WHEN 'teacher_assignments' THEN 5 WHEN 'billing' THEN 6 WHEN 'payments' THEN 7 ELSE 0 END;
--> statement-breakpoint
CREATE INDEX school_import_rows_ready ON school_import_rows (school_id, batch_id, outcome, execution_rank, id);
--> statement-breakpoint
CREATE INDEX school_import_rows_cohort ON school_import_rows (school_id, batch_id, class_group_id) WHERE outcome = 'pending';
--> statement-breakpoint
WITH counters AS (
  SELECT school_id, batch_id, data->>'outcome' AS key, 1::numeric AS value FROM school_import_rows
  UNION ALL
  SELECT r.school_id, r.batch_id, n.key, (n.value::text)::numeric FROM school_import_rows r
  CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(r.data->'result') = 'object' THEN r.data->'result' ELSE '{}'::jsonb END) n
  WHERE jsonb_typeof(n.value) = 'number'
), totals AS (SELECT school_id, batch_id, key, sum(value) AS value FROM counters GROUP BY school_id, batch_id, key),
metadata AS (SELECT school_id, batch_id, jsonb_object_agg(key,value) AS counts FROM totals GROUP BY school_id,batch_id)
UPDATE school_import_batches b SET counts = m.counts, progress_version = 1, progress_at = (b.data->>'updatedAt')::timestamptz
FROM metadata m WHERE b.school_id = m.school_id AND b.id = m.batch_id;
