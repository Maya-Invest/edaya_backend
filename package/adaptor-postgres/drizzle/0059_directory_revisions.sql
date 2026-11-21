-- Each statement advances one revision per affected school, even for bulk imports.
CREATE TABLE student_directory_revisions (
  school_id text PRIMARY KEY,
  revision uuid NOT NULL
);
--> statement-breakpoint
CREATE FUNCTION advance_student_directory_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  school_query text;
  source_query text;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    UPDATE student_directory_revisions SET revision = gen_random_uuid();
    INSERT INTO student_directory_revisions
      SELECT id, gen_random_uuid() FROM schools ON CONFLICT DO NOTHING;
    RETURN NULL;
  END IF;
  source_query := CASE TG_OP
    WHEN 'INSERT' THEN 'SELECT * FROM changed_new'
    WHEN 'DELETE' THEN 'SELECT * FROM changed_old'
    ELSE 'SELECT * FROM changed_old UNION ALL SELECT * FROM changed_new'
  END;
  -- Trigger arguments below are fixed at migration time. Project only changed
  -- school IDs, including both sides of a move; transition tables are statement-local.
  school_query := format('SELECT DISTINCT %s AS school_id FROM (%s) r %s', TG_ARGV[0], source_query, TG_ARGV[1]);
  EXECUTE format(
    'INSERT INTO student_directory_revisions SELECT school_id, gen_random_uuid() FROM (%s) changed
     WHERE school_id IS NOT NULL ORDER BY school_id
     ON CONFLICT (school_id) DO UPDATE SET revision=excluded.revision', school_query);
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE
  item record;
  event text;
  transition_tables text;
BEGIN
  FOR item IN
    SELECT unnest(ARRAY['students','guardians','guardian_student_links','student_photo_submissions',
      'class_groups','grade_levels','academic_years','academic_periods','period_definitions',
      'subjects','subject_categories','academic_disciplines','staff_members','teachers','activities',
      'schedules','lesson_sessions','activity_sessions','attendances','resources','grade_scales',
      'catalog_services','student_service_enrollments','attachments','placement_statuses',
      'staff_permission_assignments','staff_permission_profiles','staff_permission_profile_bindings',
      'staff_permission_scope_defaults','staff_manual_permission_assignments']) AS tab,
      'r.school_id' AS owner, '' AS joins
    UNION ALL SELECT * FROM (VALUES
      ('schools','r.id',''),
      ('student_class_enrollments','p.school_id','JOIN students p ON p.id=r.student_id'),
      ('attendance_records','p.school_id','JOIN students p ON p.id=r.student_id'),
      ('assessment_results','p.school_id','JOIN students p ON p.id=r.student_id'),
      ('report_card_results','p.school_id','JOIN students p ON p.id=r.student_id'),
      ('class_subjects','p.school_id','JOIN class_groups p ON p.id=r.class_group_id'),
      ('assessments','p.school_id','JOIN class_groups p ON p.id=r.class_group_id'),
      ('subject_matters','p.school_id','JOIN subjects p ON p.id=r.subject_id'),
      ('class_subject_matters','p.school_id','JOIN class_subjects cs ON cs.id=r.class_subject_id JOIN class_groups p ON p.id=cs.class_group_id'),
      ('student_subject_enrollments','p.school_id','JOIN student_class_enrollments e ON e.id=r.student_class_enrollment_id JOIN students p ON p.id=e.student_id'),
      ('activity_enrollments','p.school_id','JOIN activities p ON p.id=r.activity_id'),
      ('class_activity_enrollments','p.school_id','JOIN activities p ON p.id=r.activity_id'),
      ('staff_assignments','p.school_id','JOIN staff_members p ON p.id=r.staff_id'),
      ('teacher_assignments','p.school_id','JOIN teachers p ON p.id=r.teacher_id')
    ) AS indirect(tab,owner,joins)
  LOOP
    FOREACH event IN ARRAY ARRAY['INSERT','DELETE','UPDATE','TRUNCATE'] LOOP
      transition_tables := CASE event
        WHEN 'INSERT' THEN 'REFERENCING NEW TABLE AS changed_new'
        WHEN 'DELETE' THEN 'REFERENCING OLD TABLE AS changed_old'
        WHEN 'UPDATE' THEN 'REFERENCING OLD TABLE AS changed_old NEW TABLE AS changed_new'
        ELSE ''
      END;
      EXECUTE format('CREATE TRIGGER %I AFTER %s ON %I %s FOR EACH STATEMENT
        EXECUTE FUNCTION advance_student_directory_revision(%L,%L)',
        'directory_revision_' || lower(event), event, item.tab, transition_tables, item.owner, item.joins);
    END LOOP;
  END LOOP;
END;
$$;
