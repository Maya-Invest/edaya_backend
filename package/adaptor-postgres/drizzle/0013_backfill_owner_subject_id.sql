UPDATE schools s
SET owner_subject_id = sm.subject_id
FROM staff_members sm
WHERE s.owner_subject_id = sm.id
  AND sm.subject_id IS NOT NULL;
