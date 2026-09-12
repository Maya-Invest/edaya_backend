-- Coordinated deployment only. Run while application writers are stopped.
-- The migration runner wraps this file and its journal entry in one transaction.
LOCK TABLE staff_permission_assignments, staff_assignments IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
ALTER TABLE staff_permission_assignments ADD COLUMN scopes jsonb;
--> statement-breakpoint

CREATE TEMP TABLE authz_cutover_grains (permission text PRIMARY KEY, grain text NOT NULL) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO authz_cutover_grains VALUES
  ('SCHOOL_STRUCTURE_READ', 'school'),
  ('SCHOOL_STRUCTURE_CONFIGURE', 'school'),
  ('SCHOOL_LIFECYCLE_MANAGE', 'school'),
  ('STAFF_READ', 'school'),
  ('STAFF_CREATE', 'school'),
  ('STAFF_UPDATE', 'school'),
  ('STAFF_ARCHIVE', 'school'),
  ('ACCESS_CONTROL_READ', 'school'),
  ('ACCESS_CONTROL_CONFIGURE', 'school'),
  ('ACCESS_CONTROL_ASSIGN', 'school'),
  ('SERVICE_ACCOUNT_READ', 'school'),
  ('SERVICE_ACCOUNT_CREATE', 'school'),
  ('SERVICE_ACCOUNT_UPDATE', 'school'),
  ('SERVICE_ACCOUNT_REVOKE', 'school'),
  ('SERVICE_ACCOUNT_ROTATE_KEY', 'school'),
  ('ACADEMIC_PROGRAM_READ', 'class_group'),
  ('ACADEMIC_PROGRAM_CREATE', 'school'),
  ('ACADEMIC_PROGRAM_UPDATE', 'class_group'),
  ('ACADEMIC_PROGRAM_DELETE', 'school'),
  ('ACADEMIC_PROGRAM_ASSIGN', 'class_group'),
  ('STUDENT_READ', 'school'),
  ('STUDENT_CREATE', 'school'),
  ('STUDENT_UPDATE', 'school'),
  ('STUDENT_ARCHIVE', 'school'),
  ('STUDENT_HEALTH_READ', 'school'),
  ('STUDENT_HEALTH_UPDATE', 'school'),
  ('PARENT_READ', 'school'),
  ('PARENT_CREATE', 'school'),
  ('PARENT_UPDATE', 'school'),
  ('PARENT_ARCHIVE', 'school'),
  ('ENROLLMENT_READ', 'school'),
  ('ENROLLMENT_CREATE', 'school'),
  ('ENROLLMENT_UPDATE', 'school'),
  ('ENROLLMENT_ARCHIVE', 'school'),
  ('DISCIPLINE_READ', 'school'),
  ('DISCIPLINE_CREATE', 'class_group'),
  ('DISCIPLINE_UPDATE', 'school'),
  ('DISCIPLINE_VALIDATE', 'school'),
  ('DISCIPLINE_ARCHIVE', 'school'),
  ('ATTENDANCE_READ', 'class_group'),
  ('ATTENDANCE_RECORD', 'class_group'),
  ('ATTENDANCE_UPDATE', 'school'),
  ('ATTENDANCE_JUSTIFY', 'school'),
  ('ATTENDANCE_VALIDATE', 'school'),
  ('EXAM_CONFIG_READ', 'class_subject'),
  ('EXAM_CONFIG_CREATE', 'class_subject'),
  ('EXAM_CONFIG_UPDATE', 'class_subject'),
  ('EXAM_CONFIG_CONFIGURE', 'school'),
  ('EXAM_CONFIG_LOCK', 'school'),
  ('EXAM_CONFIG_UNLOCK', 'school'),
  ('GRADE_READ', 'class_group'),
  ('GRADE_INPUT', 'class_group'),
  ('GRADE_UPDATE', 'class_group'),
  ('GRADE_VALIDATE', 'school'),
  ('GRADE_LOCK', 'school'),
  ('GRADE_UNLOCK', 'school'),
  ('GRADE_PUBLISH', 'school'),
  ('REPORT_CARD_READ', 'school'),
  ('REPORT_CARD_CONFIGURE', 'school'),
  ('REPORT_CARD_GENERATE', 'school'),
  ('REPORT_CARD_LOCK', 'school'),
  ('REPORT_CARD_UNLOCK', 'school'),
  ('REPORT_CARD_SIGN', 'school'),
  ('REPORT_CARD_PUBLISH', 'school'),
  ('REPORT_CARD_EXPORT', 'school'),
  ('CLASS_LOGBOOK_READ', 'class_group'),
  ('CLASS_LOGBOOK_CREATE', 'class_group'),
  ('CLASS_LOGBOOK_UPDATE', 'class_group'),
  ('CLASS_LOGBOOK_VALIDATE', 'school'),
  ('TIMETABLE_READ', 'class_group'),
  ('TIMETABLE_CREATE', 'class_group'),
  ('TIMETABLE_UPDATE', 'class_group'),
  ('TIMETABLE_PUBLISH', 'school'),
  ('TIMETABLE_LOCK', 'school'),
  ('TIMETABLE_UNLOCK', 'school'),
  ('FINANCIAL_CONFIG_READ', 'school'),
  ('FINANCIAL_CONFIG_CONFIGURE', 'school'),
  ('FINANCIAL_CONFIG_UPDATE', 'school'),
  ('PAYMENT_READ', 'school'),
  ('PAYMENT_RECORD', 'school'),
  ('PAYMENT_CANCEL', 'school'),
  ('PAYMENT_REVERSE', 'school'),
  ('PAYMENT_EXPORT', 'school'),
  ('FINANCIAL_REPORT_READ', 'school'),
  ('FINANCIAL_REPORT_EXPORT', 'school'),
  ('COMMUNICATION_READ', 'school'),
  ('COMMUNICATION_CREATE', 'school'),
  ('COMMUNICATION_UPDATE', 'school'),
  ('COMMUNICATION_SEND', 'class_group'),
  ('COMMUNICATION_APPROVE', 'school'),
  ('COMMUNICATION_DELETE', 'school'),
  ('RESOURCE_READ', 'school'),
  ('RESOURCE_CONFIGURE', 'school'),
  ('ATTACHMENT_READ', 'school'),
  ('ATTACHMENT_CONFIGURE', 'school'),
  ('QUERY_WORKSPACE_READ', 'school'),
  ('QUERY_OVERVIEW_READ', 'school'),
  ('QUERY_STUDENT_DIRECTORY_READ', 'school'),
  ('QUERY_STUDENT_DETAIL_READ', 'student'),
  ('QUERY_ENROLLMENT_HISTORY_READ', 'student'),
  ('QUERY_REPORT_CARD_DETAIL_READ', 'student'),
  ('QUERY_COMMUNICATIONS_READ', 'student'),
  ('QUERY_CALENDAR_READ', 'student'),
  ('QUERY_CURRICULUM_PROGRESS_READ', 'class_group'),
  ('QUERY_CLASS_DIRECTORY_READ', 'class_group'),
  ('QUERY_CLASS_CURRICULUM_READ', 'class_group'),
  ('QUERY_TIMETABLE_READ', 'class_group'),
  ('QUERY_ATTENDANCE_READ', 'class_group'),
  ('QUERY_GUARDIAN_STUDENTS_ADMIN_READ', 'school'),
  ('QUERY_GUARDIAN_SELF_READ', 'student'),
  ('QUERY_OVERDUE_FEES_READ', 'student'),
  ('PLATFORM_REGISTER_SCHOOL', 'platform');
--> statement-breakpoint

CREATE FUNCTION pg_temp.convert_staff_scope(encoded text, grain text, tenant text, year_id text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  path text; parts text[]; first_id text; leaf_id text; target jsonb; result jsonb := '[]';
BEGIN
  IF grain = 'platform' OR grain = 'student' THEN
    RAISE EXCEPTION 'Unmigratable persisted grant grain: %', grain;
  END IF;
  IF grain = 'school' THEN
    IF encoded <> '' THEN RAISE EXCEPTION 'School action has a scoped path: %', encoded; END IF;
    RETURN '[{"kind":"school"}]';
  END IF;
  IF trim(encoded) = '' THEN RAISE EXCEPTION 'Scoped action has an empty scope'; END IF;
  FOR path IN SELECT trim(value) FROM regexp_split_to_table(encoded, '[;,]') value WHERE trim(value) <> '' LOOP
    parts := string_to_array(path, ':');
    SELECT array_agg(trim(value)) INTO parts FROM unnest(parts) value;
    IF EXISTS (SELECT 1 FROM unnest(parts) value WHERE value = '' OR value ~ '[[:space:]:;,]') THEN
      RAISE EXCEPTION 'Invalid scope path: %', path;
    END IF;
    IF (grain IN ('class_group', 'grade_level') AND cardinality(parts) <> 1)
      OR (grain IN ('class_subject', 'grade_level_subject') AND cardinality(parts) <> 2)
      OR (grain = 'activity' AND cardinality(parts) NOT BETWEEN 1 AND 2) THEN
      RAISE EXCEPTION 'Scope path has the wrong grain: % (%)', path, grain;
    END IF;
    first_id := parts[1]; leaf_id := parts[cardinality(parts)];
    IF first_id = '*' AND (cardinality(parts) = 1 OR leaf_id = '*') THEN
      target := jsonb_build_object('kind', 'all', 'grain', grain);
    ELSE
      IF first_id = '*' THEN RAISE EXCEPTION 'Ambiguous wildcard parent: %', path; END IF;
      IF grain IN ('class_group', 'class_subject') OR (grain = 'activity' AND cardinality(parts) = 2) THEN
        IF NOT EXISTS (SELECT 1 FROM class_groups WHERE id = first_id AND school_id = tenant AND academic_year_id = year_id) THEN
          RAISE EXCEPTION 'Scope class is missing or outside school/year: %', path;
        END IF;
      END IF;
      IF grain IN ('grade_level', 'grade_level_subject') THEN
        IF NOT EXISTS (SELECT 1 FROM grade_levels WHERE id = first_id AND school_id = tenant) THEN
          RAISE EXCEPTION 'Scope grade level is missing or outside school: %', path;
        END IF;
      END IF;
      CASE grain
        WHEN 'class_group' THEN target := jsonb_build_object('kind', grain, 'classGroupId', first_id);
        WHEN 'grade_level' THEN target := jsonb_build_object('kind', grain, 'gradeLevelId', first_id);
        WHEN 'class_subject' THEN
          target := jsonb_build_object('kind', grain, 'classGroupId', first_id);
          IF leaf_id <> '*' THEN
            IF NOT EXISTS (SELECT 1 FROM class_subjects WHERE id = leaf_id AND class_group_id = first_id) THEN
              RAISE EXCEPTION 'Scope class subject has an inconsistent parent: %', path;
            END IF;
            target := target || jsonb_build_object('classSubjectId', leaf_id);
          END IF;
        WHEN 'grade_level_subject' THEN
          target := jsonb_build_object('kind', grain, 'gradeLevelId', first_id);
          IF leaf_id <> '*' THEN
            IF NOT EXISTS (SELECT 1 FROM grade_level_subjects WHERE id = leaf_id AND grade_level_id = first_id) THEN
              RAISE EXCEPTION 'Scope grade subject has an inconsistent parent: %', path;
            END IF;
            target := target || jsonb_build_object('gradeLevelSubjectId', leaf_id);
          END IF;
        WHEN 'activity' THEN
          target := jsonb_build_object('kind', grain);
          IF cardinality(parts) = 2 THEN target := target || jsonb_build_object('classGroupId', first_id); END IF;
          IF leaf_id <> '*' THEN
            IF NOT EXISTS (SELECT 1 FROM activities WHERE id = leaf_id AND school_id = tenant) THEN
              RAISE EXCEPTION 'Scope activity is missing or outside school: %', path;
            END IF;
            target := target || jsonb_build_object('activityId', leaf_id);
          END IF;
        ELSE RAISE EXCEPTION 'Unknown grant grain: %', grain;
      END CASE;
    END IF;
    IF NOT result @> jsonb_build_array(target) THEN result := result || jsonb_build_array(target); END IF;
  END LOOP;
  IF jsonb_array_length(result) = 0 THEN RAISE EXCEPTION 'Scope has no paths'; END IF;
  RETURN result;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  grant_row record; assignment record; grant_grain text; permission_id text;
  converted jsonb; expected jsonb; group_id text; subject_id text; activity_id text; expected_path text;
BEGIN
  -- Validate assignment facts even when an old synchronization hook failed to create copies.
  FOR assignment IN SELECT * FROM staff_assignments LOOP
    IF num_nonnulls(assignment.class_group_id, assignment.class_subject_id, assignment.lesson_session_id,
      assignment.activity_session_id, assignment.assessment_id) <> 1 THEN
      RAISE EXCEPTION 'Assignment % has ambiguous placement', assignment.id;
    END IF;
    group_id := assignment.class_group_id; subject_id := assignment.class_subject_id; activity_id := NULL;
    IF assignment.class_subject_id IS NOT NULL THEN
      SELECT class_group_id INTO group_id FROM class_subjects WHERE id = assignment.class_subject_id;
    ELSIF assignment.lesson_session_id IS NOT NULL THEN
      SELECT class_group_id, class_subject_id INTO group_id, subject_id FROM lesson_sessions WHERE id = assignment.lesson_session_id;
    ELSIF assignment.activity_session_id IS NOT NULL THEN
      SELECT class_group_id, activities.id INTO group_id, activity_id FROM activity_sessions
        JOIN activities ON activities.id = activity_sessions.activity_id WHERE activity_sessions.id = assignment.activity_session_id;
    ELSIF assignment.assessment_id IS NOT NULL THEN
      SELECT class_group_id, class_subject_id INTO group_id, subject_id FROM assessments WHERE id = assignment.assessment_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM class_groups cg JOIN staff_members sm ON sm.id = assignment.staff_id
      JOIN academic_years ay ON ay.id = assignment.academic_year_id
      WHERE cg.id = group_id AND cg.school_id = sm.school_id AND ay.school_id = sm.school_id AND cg.academic_year_id = ay.id) THEN
      RAISE EXCEPTION 'Assignment % crosses a school/year or has a missing placement', assignment.id;
    END IF;
    FOR permission_id IN SELECT jsonb_array_elements_text(assignment.permissions) LOOP
      SELECT grain INTO grant_grain FROM authz_cutover_grains WHERE permission = permission_id;
      IF grant_grain IS NULL OR grant_grain NOT IN ('class_group', 'class_subject', 'activity')
        OR (assignment.activity_session_id IS NOT NULL AND grant_grain <> 'activity')
        OR (assignment.activity_session_id IS NULL AND grant_grain = 'activity')
        OR (assignment.assessment_id IS NOT NULL AND permission_id NOT IN ('EXAM_CONFIG_CREATE', 'GRADE_INPUT', 'GRADE_UPDATE', 'ATTENDANCE_RECORD')) THEN
        RAISE EXCEPTION 'Assignment % cannot grant action %', assignment.id, permission_id;
      END IF;
      expected_path := CASE grant_grain WHEN 'class_group' THEN group_id
        WHEN 'class_subject' THEN group_id || ':' || coalesce(subject_id, '*')
        WHEN 'activity' THEN group_id || ':' || activity_id END;
      SELECT pg_temp.convert_staff_scope(expected_path, grant_grain, school_id, assignment.academic_year_id)
        INTO expected FROM staff_members WHERE id = assignment.staff_id;
      FOR grant_row IN SELECT * FROM staff_permission_assignments WHERE source_staff_assignment_id = assignment.id AND permission = permission_id LOOP
        IF grant_row.staff_id <> assignment.staff_id OR grant_row.academic_year_id <> assignment.academic_year_id
          OR grant_row.status <> 'active' OR grant_row.starts_at IS NOT NULL OR grant_row.ends_at IS NOT NULL THEN
          RAISE EXCEPTION 'Derived grant % has ambiguous provenance or independent validity', grant_row.id;
        END IF;
        converted := pg_temp.convert_staff_scope(grant_row.scope_ids, grant_grain, grant_row.school_id, grant_row.academic_year_id);
        IF converted <> expected THEN RAISE EXCEPTION 'Derived grant % differs from its assignment', grant_row.id; END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  FOR grant_row IN SELECT spa.*, catalog.grain FROM staff_permission_assignments spa
    LEFT JOIN authz_cutover_grains catalog ON catalog.permission = spa.permission LOOP
    IF grant_row.grain IS NULL OR NOT EXISTS (SELECT 1 FROM staff_members sm JOIN academic_years ay ON ay.id = grant_row.academic_year_id
      WHERE sm.id = grant_row.staff_id AND sm.school_id = grant_row.school_id AND ay.school_id = grant_row.school_id)
      OR grant_row.status NOT IN ('active', 'inactive', 'expired') OR grant_row.ends_at < grant_row.starts_at THEN
      RAISE EXCEPTION 'Grant % has invalid action, school, year, or validity', grant_row.id;
    END IF;
    IF grant_row.source_staff_assignment_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM staff_assignments sa WHERE sa.id = grant_row.source_staff_assignment_id
        AND sa.staff_id = grant_row.staff_id AND sa.academic_year_id = grant_row.academic_year_id AND sa.permissions ? grant_row.permission) THEN
        RAISE EXCEPTION 'Derived grant % has no matching authoritative assignment', grant_row.id;
      END IF;
      DELETE FROM staff_permission_assignments WHERE id = grant_row.id;
    ELSE
      converted := pg_temp.convert_staff_scope(grant_row.scope_ids, grant_row.grain, grant_row.school_id, grant_row.academic_year_id);
      UPDATE staff_permission_assignments SET scopes = converted WHERE id = grant_row.id;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

ALTER TABLE staff_permission_assignments ALTER COLUMN scopes SET NOT NULL;
--> statement-breakpoint
ALTER TABLE staff_permission_assignments ADD CONSTRAINT staff_grant_scopes_nonempty CHECK (jsonb_typeof(scopes) = 'array' AND jsonb_array_length(scopes) > 0);
--> statement-breakpoint
ALTER TABLE staff_permission_assignments DROP COLUMN scope_ids, DROP COLUMN source_staff_assignment_id;
--> statement-breakpoint
DROP FUNCTION pg_temp.convert_staff_scope(text, text, text, text);
