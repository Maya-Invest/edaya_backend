-- The signal commits or rolls back with its source. Scope stays in Postgres.
CREATE TABLE scheduler_signals (
  ref uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  source_id text NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  published bigint NOT NULL DEFAULT 0,
  last_slot timestamptz,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(kind,source_id)
);
--> statement-breakpoint
CREATE INDEX scheduler_unpublished ON scheduler_signals(changed_at,ref) WHERE published<revision;
--> statement-breakpoint
-- Only definition edits advance this revision. Legacy heartbeat cursor writes do not.
CREATE TABLE scheduler_schedule_changes (
 kind text PRIMARY KEY, revision bigint NOT NULL DEFAULT 1, schedule_id text NOT NULL,
 expression text NOT NULL, enabled boolean NOT NULL, starts_at timestamp NOT NULL
);
--> statement-breakpoint
INSERT INTO scheduler_schedule_changes(kind,schedule_id,expression,enabled,starts_at)
 SELECT job_key,id,cron_expression,enabled,next_run_at FROM cron_job_schedules;
--> statement-breakpoint
-- Transition tables coalesce bulk imports and include both owners of moved rows.
CREATE FUNCTION scheduler_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_query text;
BEGIN
  source_query := CASE TG_OP WHEN 'INSERT' THEN 'SELECT * FROM new_rows'
    WHEN 'DELETE' THEN 'SELECT * FROM old_rows' ELSE 'SELECT * FROM old_rows UNION ALL SELECT * FROM new_rows' END;
  EXECUTE format('INSERT INTO scheduler_signals(kind,source_id)
    SELECT DISTINCT k,%s FROM (%s) r %s CROSS JOIN unnest($1) k WHERE %s IS NOT NULL AND (%s) ORDER BY 1,2
    ON CONFLICT(kind,source_id) DO UPDATE SET revision=scheduler_signals.revision+1,changed_at=clock_timestamp()',
    TG_ARGV[1],source_query,TG_ARGV[2],TG_ARGV[1],TG_ARGV[3]) USING string_to_array(TG_ARGV[0],',');
  RETURN NULL;
END $$;
--> statement-breakpoint
DO $$
DECLARE item record; op text; transition_tables text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('schools','expireAccountInvitations,processDueNotifications,reconcilePendingDeliveries,preparePrivateFileCleanup,advanceFamilyFeedbackCampaigns','r.id',''),
  ('account_invitations','expireAccountInvitations','r.school_id',''),
  ('family_feedback_campaigns','advanceFamilyFeedbackCampaigns','r.school_id',''),
  ('family_feedback_slots','advanceFamilyFeedbackCampaigns','r.school_id',''),
  ('teachers','preparePrivateFileCleanup','r.school_id',''),
  ('document_issuances','preparePrivateFileCleanup','r.school_id',''),
  ('staff_members','advanceFamilyFeedbackCampaigns,preparePrivateFileCleanup','r.school_id',''),
  ('staff_permission_assignments','advanceFamilyFeedbackCampaigns','r.school_id',''),
  ('students','advanceFamilyFeedbackCampaigns,processDueNotifications,preparePrivateFileCleanup','r.school_id',''),
  ('guardians','advanceFamilyFeedbackCampaigns,processDueNotifications,preparePrivateFileCleanup','r.school_id',''),
  ('guardian_student_links','advanceFamilyFeedbackCampaigns,processDueNotifications','r.school_id',''),
  ('activities','processDueNotifications','r.school_id',''),
  ('calendar_events','processDueNotifications','r.school_id',''),
  ('class_groups','processDueNotifications','r.school_id',''),
  ('academic_years','processDueNotifications','r.school_id',''),
  ('assessments','processDueNotifications','p.school_id','JOIN class_groups p ON p.id=r.class_group_id'),
  ('student_class_enrollments','processDueNotifications','p.school_id','JOIN students p ON p.id=r.student_id'),
  ('activity_enrollments','processDueNotifications','p.school_id','JOIN activities p ON p.id=r.activity_id'),
  ('class_activity_enrollments','processDueNotifications','p.school_id','JOIN activities p ON p.id=r.activity_id'),
  ('message_deliveries','advanceFamilyFeedbackCampaigns,processDueNotifications,reconcilePendingDeliveries','r.school_id',''),
  ('private_file_objects','preparePrivateFileCleanup','r.school_id',''),
  ('private_file_references','preparePrivateFileCleanup','r.school_id',''),
  ('student_photo_submissions','preparePrivateFileCleanup','r.school_id',''),
  ('attachments','preparePrivateFileCleanup','r.school_id',''),
  ('notify.jobs','notification','r.idempotency_key',''),
  ('notify.jobs','reconcilePendingDeliveries','r.tenant',''),
  ('notify.job_recipients','reconcilePendingDeliveries','j.tenant','JOIN notify.jobs j USING(idempotency_key)'),
  ('command_outbox','outbox','r.id','')
 ) AS t(tab,kinds,owner,joins) LOOP
   FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
     transition_tables := CASE op WHEN 'INSERT' THEN 'REFERENCING NEW TABLE AS new_rows'
       WHEN 'DELETE' THEN 'REFERENCING OLD TABLE AS old_rows' ELSE 'REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows' END;
     EXECUTE format('CREATE TRIGGER %I AFTER %s ON %s %s FOR EACH STATEMENT EXECUTE FUNCTION scheduler_changed(%L,%L,%L,%L)',
       'scheduler_'||op||'_'||split_part(item.kinds,',',1),op,item.tab,transition_tables,item.kinds,item.owner,item.joins,
       CASE WHEN item.tab='notify.jobs' AND item.kinds='notification' THEN 'r.job_kind IN (''school'',''invitation'')'
         WHEN item.tab='notify.jobs' THEN 'r.job_kind=''school''' WHEN item.tab='notify.job_recipients' THEN 'j.job_kind=''school''' ELSE 'true' END);
   END LOOP;
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION scheduler_definition_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.id,OLD.cron_expression,OLD.enabled,OLD.job_key) IS NOT DISTINCT FROM
   (NEW.id,NEW.cron_expression,NEW.enabled,NEW.job_key) THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.job_key<>NEW.job_key) THEN
   UPDATE scheduler_schedule_changes SET enabled=false,revision=revision+1 WHERE kind=OLD.job_key;
 END IF;
 IF TG_OP<>'DELETE' THEN
   INSERT INTO scheduler_schedule_changes(kind,schedule_id,expression,enabled,starts_at)
   VALUES(NEW.job_key,NEW.id,NEW.cron_expression,NEW.enabled,NEW.next_run_at)
   ON CONFLICT(kind) DO UPDATE SET schedule_id=EXCLUDED.schedule_id,expression=EXCLUDED.expression,
     enabled=EXCLUDED.enabled,starts_at=EXCLUDED.starts_at,revision=scheduler_schedule_changes.revision+1;
 END IF;
 INSERT INTO scheduler_signals(kind,source_id)
 SELECT DISTINCT k,id FROM schools CROSS JOIN unnest(ARRAY[OLD.job_key,NEW.job_key]) k WHERE k IS NOT NULL ORDER BY 1,2
 ON CONFLICT(kind,source_id) DO UPDATE SET revision=scheduler_signals.revision+1,changed_at=clock_timestamp();
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER scheduler_definition AFTER INSERT OR UPDATE OR DELETE ON cron_job_schedules
 FOR EACH ROW EXECUTE FUNCTION scheduler_definition_changed();
--> statement-breakpoint
CREATE FUNCTION rebuild_scheduler_signals() RETURNS void LANGUAGE sql AS $$
 INSERT INTO scheduler_signals(kind,source_id)
 SELECT kind,source_id FROM scheduler_signals WHERE kind NOT IN ('outbox','notification') OR published<revision
 UNION SELECT job_key,s.id FROM cron_job_schedules CROSS JOIN schools s
 UNION SELECT 'outbox',id FROM command_outbox WHERE status IN ('pending','failed','running','dead')
 UNION SELECT 'notification',idempotency_key FROM notify.jobs WHERE job_kind IN ('school','invitation') AND status IN ('pending','failed','sending','dead')
 ORDER BY 1,2 ON CONFLICT(kind,source_id) DO UPDATE SET revision=scheduler_signals.revision+1
$$;
--> statement-breakpoint
SELECT rebuild_scheduler_signals();
