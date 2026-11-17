-- Run immediately after migration, before accepting new writes. Both discrepancy queries should be empty.
SELECT a.id AS changed_historical_entry FROM logbook_legacy_entries a
LEFT JOIN class_subject_progress p ON p.id=a.id
WHERE p.id IS NULL OR (to_jsonb(p)-'completed') IS DISTINCT FROM a.original
  OR p.completed IS DISTINCT FROM a.inferred_completed;

WITH evidence AS (
  SELECT m.id,m.class_subject_id,s.progress_weight::numeric AS weight,
    CASE WHEN bool_or(p.completed) THEN 1 WHEN count(p.completed)>0 THEN 0.5 ELSE 0 END AS score
  FROM class_subject_matters m JOIN subject_matters s ON s.id=m.subject_matter_id
    LEFT JOIN class_subject_progress p ON p.class_subject_matter_id=m.id
  GROUP BY m.id,m.class_subject_id,s.progress_weight
), expected AS (
  SELECT c.id,count(e.id) AS chapters, count(*) FILTER (WHERE e.score=1) AS completed,
    count(*) FILTER (WHERE e.score=0.5) AS ongoing,
    coalesce(round(100*sum(e.score*e.weight)/nullif(sum(e.weight),0)),0) AS coverage
  FROM class_subjects c LEFT JOIN evidence e ON e.class_subject_id=c.id GROUP BY c.id
)
SELECT e.* FROM expected e JOIN class_subjects c ON c.id=e.id
WHERE (e.chapters,e.completed,e.ongoing,e.coverage) IS DISTINCT FROM
  (c.chapter_count,c.completed_chapter_count,c.ongoing_chapter_count,c.completed_percentage);

SELECT l.school_id, count(*) AS preserved_entries, count(*) FILTER (WHERE p.completed IS NULL) AS historical_references,
  count(*) FILTER (WHERE p.completed) AS inferred_completions, count(p.notes) AS with_notes, count(p.recorded_by_staff_id) AS with_author
FROM class_subject_progress p JOIN lesson_sessions l ON l.id=p.lesson_session_id GROUP BY l.school_id ORDER BY l.school_id;
SELECT school_id,status,count(*) FROM teacher_corrections WHERE workflow='logbook' GROUP BY school_id,status ORDER BY school_id,status;
SELECT school_id,count(*) FILTER (WHERE (payload->>'locked')::boolean) AS locked_records
FROM teacher_workflow_states WHERE workflow='logbook' GROUP BY school_id ORDER BY school_id;
SELECT completed_percentage,count(*) FROM class_subjects GROUP BY completed_percentage ORDER BY completed_percentage;
