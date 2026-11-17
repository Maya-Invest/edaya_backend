-- The migrator runs the cutover in a transaction. Checks precede any data changes.
LOCK TABLE class_subject_progress, class_subject_matters, class_subjects, subject_matters,
  lesson_sessions, teacher_corrections, teacher_workflow_states IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM class_subject_progress GROUP BY lesson_session_id, class_subject_matter_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM class_subject_matters GROUP BY class_subject_id, subject_matter_id HAVING count(*) > 1)
    OR EXISTS (
      SELECT 1 FROM class_subject_progress p
      LEFT JOIN class_subject_matters m ON m.id = p.class_subject_matter_id
      LEFT JOIN lesson_sessions l ON l.id = p.lesson_session_id
      LEFT JOIN class_subjects c ON c.id=m.class_subject_id
      LEFT JOIN class_groups g ON g.id=c.class_group_id
      WHERE m.id IS NULL OR l.id IS NULL OR l.class_subject_id IS DISTINCT FROM m.class_subject_id
        OR l.class_group_id IS DISTINCT FROM c.class_group_id OR l.school_id IS DISTINCT FROM g.school_id
        OR p.completed_percentage NOT BETWEEN 0 AND 100)
    OR EXISTS (SELECT 1 FROM class_subject_matters m LEFT JOIN class_subjects c ON c.id=m.class_subject_id
      LEFT JOIN subject_matters s ON s.id=m.subject_matter_id
      WHERE c.id IS NULL OR s.id IS NULL OR s.subject_id <> c.subject_id)
    OR EXISTS (SELECT 1 FROM class_subjects c WHERE c.completed_percentage > 0
      AND NOT EXISTS (SELECT 1 FROM class_subject_matters m JOIN class_subject_progress p ON p.class_subject_matter_id=m.id
        WHERE m.class_subject_id=c.id AND (p.completed_percentage>0 OR to_jsonb(p)->>'completed' IS NOT NULL)))
    OR EXISTS (SELECT 1 FROM class_subject_matters m WHERE (m.completed_percentage > 0 OR m.status <> 'not_started')
      AND NOT EXISTS (SELECT 1 FROM class_subject_progress p WHERE p.class_subject_matter_id=m.id
        AND (p.completed_percentage > 0 OR to_jsonb(p)->>'completed' IS NOT NULL)))
  THEN RAISE EXCEPTION 'Reconcile duplicate, invalid, unlinked or unsupported logbook records before migration';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE subject_matters ADD COLUMN IF NOT EXISTS progress_weight double precision NOT NULL DEFAULT 1
  CHECK (progress_weight > 0 AND progress_weight < 'Infinity'::double precision);
--> statement-breakpoint
ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS chapter_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ongoing_chapter_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_chapter_count integer NOT NULL DEFAULT 0,
  ALTER COLUMN completed_percentage SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE class_subject_matters ALTER COLUMN status SET DEFAULT 'not_started', ALTER COLUMN completed_percentage SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE class_subject_progress ADD COLUMN IF NOT EXISTS completed boolean,
  ALTER COLUMN completed_percentage DROP NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS logbook_lesson_chapter_uidx ON class_subject_progress(lesson_session_id,class_subject_matter_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS logbook_chapter_idx ON class_subject_progress(class_subject_matter_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS logbook_class_chapter_uidx ON class_subject_matters(class_subject_id,subject_matter_id);
--> statement-breakpoint
-- The archive freezes the first inferred completion even if its lesson is corrected later.
CREATE TABLE IF NOT EXISTS logbook_legacy_entries (
  id text PRIMARY KEY, original jsonb NOT NULL, inferred_completed boolean
);
--> statement-breakpoint
WITH ranked AS (
  SELECT p.id, to_jsonb(p) - 'completed' AS original, p.completed_percentage AS pct,
    count(*) FILTER (WHERE p.completed_percentage=100) OVER (
      PARTITION BY p.class_subject_matter_id ORDER BY l.starts_at,p.recorded_at,p.id) AS completions
  FROM class_subject_progress p JOIN lesson_sessions l ON l.id=p.lesson_session_id
  WHERE p.completed_percentage IS NOT NULL
), archived AS (
  INSERT INTO logbook_legacy_entries SELECT id,original,
    CASE WHEN pct=0 THEN NULL ELSE pct=100 AND completions=1 END FROM ranked
  ON CONFLICT DO NOTHING RETURNING id,inferred_completed
)
UPDATE class_subject_progress p SET completed=a.inferred_completed FROM archived a WHERE p.id=a.id;
--> statement-breakpoint
-- Only a migrated zero may be a historical reference. Promotion reuses its row.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='logbook_counted_or_legacy_zero') THEN
    ALTER TABLE class_subject_progress ADD CONSTRAINT logbook_counted_or_legacy_zero
      CHECK (completed IS NOT NULL OR completed_percentage IS NOT DISTINCT FROM 0);
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION refresh_logbook_subject(offering text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 -- A separate statement after the lock sees any earlier committed class changes.
 PERFORM 1 FROM class_subjects WHERE id=offering FOR NO KEY UPDATE;
 UPDATE class_subjects c SET chapter_count=t.total, ongoing_chapter_count=t.ongoing,
   completed_chapter_count=t.finished, completed_percentage=t.coverage
 FROM (SELECT count(*) AS total, count(*) FILTER (WHERE m.status='in_progress') AS ongoing,
   count(*) FILTER (WHERE m.status='completed') AS finished,
   coalesce(round(100 * sum(s.progress_weight::numeric * CASE m.status WHEN 'completed' THEN 1 WHEN 'in_progress' THEN 0.5 ELSE 0 END)
     / nullif(sum(s.progress_weight::numeric),0)),0) AS coverage
   FROM class_subject_matters m JOIN subject_matters s ON s.id=m.subject_matter_id WHERE m.class_subject_id=offering) t
 WHERE c.id=offering AND (c.chapter_count,c.ongoing_chapter_count,c.completed_chapter_count,c.completed_percentage)
 IS DISTINCT FROM (t.total,t.ongoing,t.finished,t.coverage);
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION refresh_logbook_chapter(chapter text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM class_subjects WHERE id=(SELECT class_subject_id FROM class_subject_matters WHERE id=chapter) FOR NO KEY UPDATE;
 UPDATE class_subject_matters m SET
   status=CASE WHEN t.finished IS NOT NULL THEN 'completed' WHEN t.started IS NOT NULL THEN 'in_progress' ELSE 'not_started' END,
   completed_percentage=CASE WHEN t.finished IS NOT NULL THEN 100 WHEN t.started IS NOT NULL THEN 50 ELSE 0 END,
   started_at=t.started,completed_at=t.finished
 FROM (SELECT min(l.starts_at) AS started, min(l.starts_at) FILTER (WHERE p.completed) AS finished
   FROM class_subject_progress p JOIN lesson_sessions l ON l.id=p.lesson_session_id
   WHERE p.class_subject_matter_id=chapter AND p.completed IS NOT NULL) t
 WHERE m.id=chapter;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logbook_refresh_on_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN PERFORM refresh_logbook_chapter(OLD.class_subject_matter_id);
  ELSE PERFORM refresh_logbook_chapter(NEW.class_subject_matter_id);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logbook_refresh_on_chapter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM 1 FROM subject_matters WHERE id=NEW.subject_matter_id FOR SHARE;
  END IF;
  IF TG_OP='DELETE' THEN PERFORM refresh_logbook_subject(OLD.class_subject_id);
  ELSE PERFORM refresh_logbook_subject(NEW.class_subject_id);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logbook_refresh_on_weight() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_logbook_subject(m.class_subject_id) FROM class_subject_matters m WHERE m.subject_matter_id=NEW.id ORDER BY m.class_subject_id;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logbook_refresh_on_lesson_date() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_logbook_chapter(p.class_subject_matter_id) FROM class_subject_progress p WHERE p.lesson_session_id=NEW.id;
  RETURN NULL;
END $$;
--> statement-breakpoint
SELECT refresh_logbook_chapter(id) FROM class_subject_matters;
--> statement-breakpoint
SELECT refresh_logbook_subject(id) FROM class_subjects;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER logbook_entry_changed AFTER INSERT OR UPDATE OF completed OR DELETE ON class_subject_progress
  FOR EACH ROW EXECUTE FUNCTION logbook_refresh_on_entry();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER logbook_chapter_changed AFTER INSERT OR UPDATE OF status OR DELETE ON class_subject_matters
  FOR EACH ROW EXECUTE FUNCTION logbook_refresh_on_chapter();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER logbook_weight_changed AFTER UPDATE OF progress_weight ON subject_matters
  FOR EACH ROW WHEN (OLD.progress_weight IS DISTINCT FROM NEW.progress_weight) EXECUTE FUNCTION logbook_refresh_on_weight();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER logbook_lesson_moved AFTER UPDATE OF starts_at ON lesson_sessions
  FOR EACH ROW WHEN (OLD.starts_at IS DISTINCT FROM NEW.starts_at) EXECUTE FUNCTION logbook_refresh_on_lesson_date();
--> statement-breakpoint
-- Preserve untouched audit payloads, including requests that were already stale before conversion.
CREATE TABLE IF NOT EXISTS logbook_legacy_workflows (
  kind text NOT NULL, school_id text NOT NULL, target_id text NOT NULL, original jsonb NOT NULL,
  PRIMARY KEY(kind,school_id,target_id)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pg_temp.convert_logbook_json(v jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE converted jsonb;
BEGIN
  IF jsonb_typeof(v)='array' THEN
    SELECT coalesce(jsonb_agg(pg_temp.convert_logbook_json(value) ORDER BY n),'[]') INTO converted
      FROM jsonb_array_elements(v) WITH ORDINALITY AS a(value,n);
    RETURN converted;
  ELSIF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RETURN v;
  ELSIF v->>'workflow'='logbook' AND jsonb_typeof(v->'progress')='array' THEN
    SELECT coalesce(jsonb_agg(
      CASE WHEN item ? 'completedPercentage' THEN
        jsonb_build_object('matterId',item->'matterId','completed',CASE WHEN (item->>'completedPercentage')::numeric <> 100 THEN false
          WHEN a.original->>'completed_percentage'='100' THEN a.inferred_completed ELSE true END)
        || jsonb_build_object('notes',a.original->'notes')
      ELSE item END ORDER BY item->>'matterId'),'[]') INTO converted
    FROM jsonb_array_elements(v->'progress') item LEFT JOIN logbook_legacy_entries a
      ON a.original->>'lesson_session_id'=v->>'targetId' AND a.original->>'class_subject_matter_id'=item->>'matterId'
    WHERE NOT (item ? 'completedPercentage') OR (item->>'completedPercentage')::numeric > 0;
    RETURN jsonb_set(v,'{progress}',converted) || '{"formatVersion":2}'::jsonb;
  ELSE
    SELECT coalesce(jsonb_object_agg(key,pg_temp.convert_logbook_json(value)),'{}') INTO converted FROM jsonb_each(v);
    RETURN converted;
  END IF;
END $$;
--> statement-breakpoint
WITH archived AS (INSERT INTO logbook_legacy_workflows SELECT 'state',school_id,target_id,payload
  FROM teacher_workflow_states WHERE workflow='logbook' AND payload::text NOT LIKE '%"formatVersion"%'
  ON CONFLICT DO NOTHING RETURNING *)
UPDATE teacher_workflow_states s SET payload=pg_temp.convert_logbook_json(a.original)
 FROM archived a WHERE s.school_id=a.school_id AND s.workflow='logbook' AND s.target_id=a.target_id;
--> statement-breakpoint
WITH archived AS (INSERT INTO logbook_legacy_workflows SELECT 'request',school_id,id,payload
  FROM teacher_corrections WHERE workflow='logbook' AND payload::text NOT LIKE '%"formatVersion"%'
  ON CONFLICT DO NOTHING RETURNING *),
converted AS (
 SELECT a.*, pg_temp.convert_logbook_json(a.original) AS normalized,
   (SELECT jsonb_build_object('workflow','logbook','targetId',l.id,'sessionNote',l.session_note,'progress',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('matterId',p.class_subject_matter_id,'completedPercentage',p.completed_percentage)
        ORDER BY p.class_subject_matter_id),'[]') FROM class_subject_progress p WHERE p.lesson_session_id=l.id))
    FROM lesson_sessions l WHERE l.id=a.original->>'targetId') AS official,
   (SELECT w.original#>'{payload,snapshot}' FROM logbook_legacy_workflows w WHERE w.kind='state'
      AND w.school_id=a.school_id AND w.target_id='correction:'||a.target_id) AS captured
 FROM archived a)
UPDATE teacher_corrections c SET payload=CASE WHEN c.status='pending' AND
  (a.official IS DISTINCT FROM a.original->'before' OR a.captured IS DISTINCT FROM a.original->'before'
   OR (a.original->>'baseVersion')::integer IS DISTINCT FROM (SELECT (s.payload->>'version')::integer FROM teacher_workflow_states s WHERE s.school_id=c.school_id AND s.workflow='logbook' AND s.target_id=c.target_id))
  THEN a.normalized || '{"legacySourceConflict":true}'::jsonb
  WHEN c.status='pending' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(a.original#>'{proposal,progress}') p
    WHERE (p->>'completedPercentage')::numeric IN (0,100) AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(a.original#>'{before,progress}') b WHERE b=p))
  THEN a.normalized || '{"legacyNeedsReview":true}'::jsonb ELSE a.normalized END
FROM converted a WHERE c.school_id=a.school_id AND c.id=a.target_id;
--> statement-breakpoint
UPDATE teacher_workflow_states s SET payload=jsonb_set(s.payload,'{payload,legacyOriginal}',
  jsonb_build_object('before',a.original->'before','proposal',a.original->'proposal','revisions',a.original->'revisions'))
FROM logbook_legacy_workflows a WHERE a.kind='request' AND s.school_id=a.school_id
  AND s.workflow='logbook' AND s.target_id='correction:'||a.target_id AND NOT (s.payload->'payload' ? 'legacyOriginal');
