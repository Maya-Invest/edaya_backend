-- Run on the pre-cutover copy, then again while logbook writes are paused.
SELECT l.school_id, count(*) AS session_chapters,
  count(*) FILTER (WHERE p.completed_percentage=0) AS historical_references,
  count(*) FILTER (WHERE p.completed_percentage BETWEEN 1 AND 99) AS partial_entries,
  count(*) FILTER (WHERE p.completed_percentage=100) AS cumulative_completions,
  count(DISTINCT p.class_subject_matter_id) FILTER (WHERE p.completed_percentage=100) AS inferred_completions,
  count(p.notes) AS with_notes, count(p.recorded_by_staff_id) AS with_author
FROM class_subject_progress p LEFT JOIN lesson_sessions l ON l.id=p.lesson_session_id
GROUP BY l.school_id ORDER BY l.school_id;

SELECT id, reason FROM (
  SELECT p.id, 'invalid lesson or chapter' AS reason FROM class_subject_progress p
  LEFT JOIN lesson_sessions l ON l.id=p.lesson_session_id LEFT JOIN class_subject_matters m ON m.id=p.class_subject_matter_id
  LEFT JOIN class_subjects c ON c.id=m.class_subject_id LEFT JOIN class_groups g ON g.id=c.class_group_id
  WHERE l.id IS NULL OR m.id IS NULL OR l.class_subject_id IS DISTINCT FROM m.class_subject_id
    OR l.class_group_id IS DISTINCT FROM c.class_group_id OR l.school_id IS DISTINCT FROM g.school_id
    OR p.completed_percentage NOT BETWEEN 0 AND 100
  UNION ALL SELECT min(id), 'duplicate lesson chapter' FROM class_subject_progress
    GROUP BY lesson_session_id,class_subject_matter_id HAVING count(*)>1
  UNION ALL SELECT min(id), 'duplicate assigned chapter' FROM class_subject_matters
    GROUP BY class_subject_id,subject_matter_id HAVING count(*)>1
  UNION ALL SELECT m.id,'broken curriculum link' FROM class_subject_matters m
    LEFT JOIN class_subjects c ON c.id=m.class_subject_id LEFT JOIN subject_matters s ON s.id=m.subject_matter_id
    WHERE c.id IS NULL OR s.id IS NULL OR c.subject_id<>s.subject_id
  UNION ALL SELECT m.id,'chapter total without lesson evidence' FROM class_subject_matters m
    WHERE (m.completed_percentage>0 OR m.status <> 'not_started') AND NOT EXISTS (SELECT 1 FROM class_subject_progress p
      WHERE p.class_subject_matter_id=m.id AND p.completed_percentage>0)
  UNION ALL SELECT c.id,'subject total without lesson evidence' FROM class_subjects c
    WHERE c.completed_percentage>0 AND NOT EXISTS (SELECT 1 FROM class_subject_matters m
      JOIN class_subject_progress p ON p.class_subject_matter_id=m.id
      WHERE m.class_subject_id=c.id AND p.completed_percentage>0)
) problems ORDER BY reason,id;

SELECT school_id,status,count(*) FROM teacher_corrections WHERE workflow='logbook' GROUP BY school_id,status ORDER BY school_id,status;
SELECT school_id,count(*) FILTER (WHERE (payload->>'locked')::boolean) AS locked_records
FROM teacher_workflow_states WHERE workflow='logbook' GROUP BY school_id ORDER BY school_id;
SELECT completed_percentage,count(*) FROM class_subjects GROUP BY completed_percentage ORDER BY completed_percentage;
