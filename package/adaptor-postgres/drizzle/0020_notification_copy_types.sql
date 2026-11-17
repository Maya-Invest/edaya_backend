ALTER TABLE notify.recipients ADD COLUMN IF NOT EXISTS phone text;
--> statement-breakpoint
ALTER TABLE notify.recipients ADD COLUMN IF NOT EXISTS channel_sms boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE notify.jobs ADD COLUMN IF NOT EXISTS sms_body text;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION school_notification_migrate_event(old jsonb, fallback jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'enable_email', true,
    'enable_push', true,
    'enable_sms', false,
    'base_message', jsonb_build_object(
      'title', COALESCE(NULLIF(old->'in_app'->>'subject', ''), fallback#>>'{base_message,title}'),
      'body', COALESCE(NULLIF(old->'in_app'->>'body', ''), fallback#>>'{base_message,body}')
    ),
    'rich_message', jsonb_build_object(
      'subject', COALESCE(NULLIF(old->'email'->>'subject', ''), fallback#>>'{rich_message,subject}'),
      'body', COALESCE(NULLIF(old->'email'->>'body', ''), fallback#>>'{rich_message,body}')
    ),
    'simple_message', fallback->'simple_message'
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION school_notification_migrate_invitation(old jsonb, fallback jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'rich_message', jsonb_build_object(
      'subject', COALESCE(NULLIF(old->'email'->>'subject', ''), fallback#>>'{rich_message,subject}'),
      'body', COALESCE(NULLIF(old->'email'->>'body', ''), fallback#>>'{rich_message,body}')
    ),
    'simple_message', fallback->'simple_message'
  );
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.school_notification_templates') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE school_notification_templates
    ADD COLUMN IF NOT EXISTS invitation_sms_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS announcement_published jsonb,
    ADD COLUMN IF NOT EXISTS report_card_published jsonb,
    ADD COLUMN IF NOT EXISTS attendance_recorded jsonb,
    ADD COLUMN IF NOT EXISTS assessment_result_recorded jsonb,
    ADD COLUMN IF NOT EXISTS incident_recorded jsonb,
    ADD COLUMN IF NOT EXISTS assessment_due_soon jsonb,
    ADD COLUMN IF NOT EXISTS activity_reminder jsonb,
    ADD COLUMN IF NOT EXISTS calendar_event_reminder jsonb,
    ADD COLUMN IF NOT EXISTS account_invitation jsonb;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_notification_templates'
      AND column_name = 'templates'
  ) THEN
    UPDATE school_notification_templates SET
      announcement_published = school_notification_migrate_event(
        templates->'announcement.published',
        '{"enable_email":true,"enable_push":true,"enable_sms":false,"base_message":{"title":"{{schoolName}}: {{announcementTitle}}","body":"{{announcementBodyShort}}"},"rich_message":{"subject":"{{schoolName}}: {{announcementTitle}}","body":"<p>{{announcementBody}}</p>"},"simple_message":{"body":"{{schoolName}}: {{announcementTitle}} — {{announcementBodyShort}}"}}'::jsonb
      ),
      report_card_published = school_notification_migrate_event(
        templates->'report_card.published',
        '{"enable_email":true,"enable_push":true,"enable_sms":false,"base_message":{"title":"Report card — {{studentName}}","body":"{{periodName}} results for {{classGroupName}} are available."},"rich_message":{"subject":"Report card — {{studentName}}","body":"<p>{{periodName}} results for {{classGroupName}} are available.</p>"},"simple_message":{"body":"Report card — {{studentName}}: {{periodName}} results for {{classGroupName}} are available."}}'::jsonb
      ),
      attendance_recorded = school_notification_migrate_event(
        templates->'attendance.recorded',
        '{"enable_email":true,"enable_push":true,"enable_sms":false,"base_message":{"title":"{{studentName}} — {{statusLabel}}","body":"{{sessionTitle}} on {{sessionDate}} at {{sessionTime}} ({{classGroupName}})"},"rich_message":{"subject":"{{studentName}} — {{statusLabel}}","body":"<p>{{sessionTitle}} on {{sessionDate}} at {{sessionTime}} ({{classGroupName}})</p>"},"simple_message":{"body":"{{studentName}} — {{statusLabel}}: {{sessionTitle}} on {{sessionDate}} at {{sessionTime}} ({{classGroupName}})"}}'::jsonb
      ),
      assessment_result_recorded = school_notification_migrate_event(
        templates->'assessment.result_recorded',
        '{"enable_email":true,"enable_push":true,"enable_sms":false,"base_message":{"title":"{{studentName}} — {{assessmentTitle}}","body":"Score {{scoreDisplay}} · {{subjectName}}"},"rich_message":{"subject":"{{studentName}} — {{assessmentTitle}}","body":"<p>Score {{scoreDisplay}} · {{subjectName}}</p>"},"simple_message":{"body":"{{studentName}} — {{assessmentTitle}}: Score {{scoreDisplay}} · {{subjectName}}"}}'::jsonb
      ),
      incident_recorded = school_notification_migrate_event(
        templates->'incident.recorded',
        '{"enable_email":true,"enable_push":true,"enable_sms":false,"base_message":{"title":"{{studentName}} — {{incidentTitle}}","body":"{{incidentKindLabel}} on {{incidentDate}}. {{incidentDescription}}"},"rich_message":{"subject":"{{studentName}} — {{incidentTitle}}","body":"<p>{{incidentKindLabel}} on {{incidentDate}}. {{incidentDescription}}</p>"},"simple_message":{"body":"{{studentName}} — {{incidentTitle}}: {{incidentKindLabel}} on {{incidentDate}}. {{incidentDescription}}"}}'::jsonb
      ),
      assessment_due_soon = school_notification_migrate_event(
        templates->'assessment.due_soon',
        '{"enable_email":true,"enable_push":true,"enable_sms":false,"base_message":{"title":"{{assessmentTitle}} due {{dueDateLabel}}","body":"{{subjectName}} · {{classGroupName}} — due {{dueDateLabel}}"},"rich_message":{"subject":"{{assessmentTitle}} due {{dueDateLabel}}","body":"<p>{{subjectName}} · {{classGroupName}} — due {{dueDateLabel}}</p>"},"simple_message":{"body":"{{assessmentTitle}} due {{dueDateLabel}}: {{subjectName}} · {{classGroupName}} — due {{dueDateLabel}}"}}'::jsonb
      ),
      activity_reminder = school_notification_migrate_event(
        templates->'activity.reminder',
        '{"enable_email":true,"enable_push":true,"enable_sms":false,"base_message":{"title":"Reminder: {{activityName}}","body":"{{startDate}} · {{activitySchedule}} ({{coachName}})"},"rich_message":{"subject":"Reminder: {{activityName}}","body":"<p>{{startDate}} · {{activitySchedule}} ({{coachName}})</p>"},"simple_message":{"body":"Reminder: {{activityName}}: {{startDate}} · {{activitySchedule}} ({{coachName}})"}}'::jsonb
      ),
      calendar_event_reminder = school_notification_migrate_event(
        templates->'calendar.event_reminder',
        '{"enable_email":true,"enable_push":true,"enable_sms":false,"base_message":{"title":"Reminder: {{eventTitle}}","body":"{{dateRange}} · {{scopeLabel}}"},"rich_message":{"subject":"Reminder: {{eventTitle}}","body":"<p>{{dateRange}} · {{scopeLabel}}</p>"},"simple_message":{"body":"Reminder: {{eventTitle}}: {{dateRange}} · {{scopeLabel}}"}}'::jsonb
      ),
      account_invitation = school_notification_migrate_invitation(
        templates->'account_invitation',
        '{"rich_message":{"subject":"You''re invited to join {{schoolName}} on EDaya","body":"<p>Hello {{inviteeName}},</p><p>You have been invited to connect your account to {{schoolName}} on EDaya.</p><p><a href=\"{{inviteUrl}}\">Accept invitation</a></p><p>This link expires on {{expiresAt}}.</p>"},"simple_message":{"body":"{{schoolName}} invited you to EDaya. Accept: {{inviteUrl}}"}}'::jsonb
      ),
      invitation_sms_enabled = false;

    ALTER TABLE school_notification_templates
      ALTER COLUMN announcement_published SET NOT NULL,
      ALTER COLUMN report_card_published SET NOT NULL,
      ALTER COLUMN attendance_recorded SET NOT NULL,
      ALTER COLUMN assessment_result_recorded SET NOT NULL,
      ALTER COLUMN incident_recorded SET NOT NULL,
      ALTER COLUMN assessment_due_soon SET NOT NULL,
      ALTER COLUMN activity_reminder SET NOT NULL,
      ALTER COLUMN calendar_event_reminder SET NOT NULL,
      ALTER COLUMN account_invitation SET NOT NULL,
      DROP COLUMN templates;
  END IF;
END $$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS school_notification_migrate_event(jsonb, jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS school_notification_migrate_invitation(jsonb, jsonb);
