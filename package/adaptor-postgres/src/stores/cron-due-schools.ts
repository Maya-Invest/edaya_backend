import type { CronJobKey } from '@edaya/service'
import type { SQL } from 'drizzle-orm'
import { FAMILY_FEEDBACK_FINAL_REMINDER_MS, FAMILY_FEEDBACK_PURGE_WARN_MS, FAMILY_FEEDBACK_RETENTION_MS, Permission } from '@edaya/core'
import { ACTIVITY_REMINDER_EVENT_KEY, ACTIVITY_REMINDER_LEAD_HOURS, ASSESSMENT_DUE_SOON_EVENT_KEY, ASSESSMENT_DUE_SOON_LEAD_DAYS, CALENDAR_EVENT_REMINDER_EVENT_KEY, CALENDAR_EVENT_REMINDER_LEAD_HOURS } from '@edaya/service'
import { sql } from 'drizzle-orm'
import { duePrivateFileObject, isAbandonedPortrait } from './private-file-cleanup-queries'

// A source may already have been delivered to one profile while another has just become eligible.
const missingDelivery = sql`NOT EXISTS (
  SELECT 1 FROM message_deliveries d
  WHERE (d.school_id, d.source_key, d.subject_id, d.recipient_kind, d.recipient_id)
      = (r.school_id, r.source_key, r.subject_id, r.recipient_kind, r.recipient_id)
)`

function notificationSchools(asOf: Date): SQL {
  const now = asOf.toISOString()
  const hoursFromNow = (hours: number) => new Date(asOf.getTime() + hours * 3600000).toISOString()
  return sql`WITH due_activities AS (
    SELECT id, school_id FROM activities
    WHERE start_date BETWEEN ${now} AND ${hoursFromNow(ACTIVITY_REMINDER_LEAD_HOURS)} AND end_date >= ${now}
  ), sources AS (
    SELECT c.school_id, ${ASSESSMENT_DUE_SOON_EVENT_KEY} || ':' || a.id AS source_key,
           e.student_id, false AS include_guardians
    FROM assessments a
    JOIN class_groups c ON c.id = a.class_group_id
    JOIN student_class_enrollments e ON e.class_group_id = c.id AND e.status = 'active'
    WHERE a.kind = 'homework' AND a.completed_at IS NULL
      AND a.due_at BETWEEN ${now} AND ${hoursFromNow(24 * ASSESSMENT_DUE_SOON_LEAD_DAYS)}
    UNION ALL
    SELECT a.school_id, ${ACTIVITY_REMINDER_EVENT_KEY} || ':' || a.id, e.student_id, true
    FROM due_activities a JOIN activity_enrollments e ON e.activity_id = a.id AND e.status = 'approved'
    JOIN students t ON t.id = e.student_id AND t.school_id = a.school_id AND t.status = 'active'
    UNION ALL
    SELECT a.school_id, ${ACTIVITY_REMINDER_EVENT_KEY} || ':' || a.id, e.student_id, true
    FROM due_activities a
    JOIN class_activity_enrollments p ON p.activity_id = a.id
    JOIN class_groups c ON c.id = p.class_group_id AND c.school_id = a.school_id
    JOIN academic_years y ON y.id = c.academic_year_id AND y.school_id = a.school_id AND y.status = 'published'
    JOIN student_class_enrollments e ON e.class_group_id = c.id AND e.academic_year_id = y.id AND e.status = 'active'
    JOIN students t ON t.id = e.student_id AND t.school_id = a.school_id AND t.status = 'active'
    UNION ALL
    SELECT c.school_id, ${CALENDAR_EVENT_REMINDER_EVENT_KEY} || ':' || v.id, e.student_id, true
    FROM calendar_events v JOIN class_groups c ON c.school_id = v.school_id AND (
      (v.scope_kind = 'class_group' AND c.id = v.scope_id) OR
      (v.scope_kind = 'grade_level' AND c.grade_level_id = v.scope_id AND c.academic_year_id = v.academic_year_id))
    JOIN student_class_enrollments e ON e.class_group_id = c.id AND e.status = 'active'
    WHERE v.kind = 'event' AND v.start_date BETWEEN ${now} AND ${hoursFromNow(CALENDAR_EVENT_REMINDER_LEAD_HOURS)}
      AND v.end_date >= ${now}
  ), recipients AS (
    SELECT s.school_id, s.source_key, t.subject_id, 'student' AS recipient_kind, t.id AS recipient_id
    FROM sources s JOIN students t ON t.id = s.student_id AND t.school_id = s.school_id
    WHERE t.status = 'active' AND t.subject_id IS NOT NULL
    UNION ALL
    SELECT s.school_id, s.source_key, g.subject_id, 'guardian', g.id
    FROM sources s JOIN guardian_student_links l ON l.school_id = s.school_id AND l.student_id = s.student_id
    JOIN guardians g ON g.id = l.guardian_id AND g.school_id = s.school_id
    WHERE s.include_guardians AND g.has_access AND g.subject_id IS NOT NULL
  )
  SELECT r.school_id FROM recipients r WHERE ${missingDelivery}`
}

function feedbackSchools(asOf: Date): SQL {
  const now = asOf.toISOString()
  const purgeBefore = new Date(asOf.getTime() - FAMILY_FEEDBACK_RETENTION_MS).toISOString()
  const warnBefore = new Date(asOf.getTime() - FAMILY_FEEDBACK_RETENTION_MS + FAMILY_FEEDBACK_PURGE_WARN_MS).toISOString()
  return sql`WITH retention AS (
    SELECT c.*, COALESCE(c.closed_at, c.cancelled_at) AS anchor FROM family_feedback_campaigns c
    WHERE c.status IN ('closed', 'cancelled', 'published') AND c.answers_purged_at IS NULL
  ), reminder_times AS (
    SELECT c.*, date_trunc('milliseconds', c.opened_at + (c.closes_at - c.opened_at) / 2) AS mid_at,
           c.closes_at - ${FAMILY_FEEDBACK_FINAL_REMINDER_MS} * interval '1 millisecond' AS final_at
    FROM family_feedback_campaigns c WHERE c.status = 'open' AND c.closes_at > ${now}
  ), recipients AS (
    SELECT c.school_id, 'family_feedback.reminder:' || c.id || ':' || s.student_id || ':' || reminder.kind AS source_key,
           g.subject_id, 'guardian' AS recipient_kind, g.id AS recipient_id
    FROM reminder_times c
    CROSS JOIN LATERAL (VALUES ('mid', c.mid_at), ('final', c.final_at)) AS reminder(kind, due_at)
    JOIN family_feedback_slots s ON s.school_id = c.school_id AND s.campaign_id = c.id AND s.status = 'open'
    JOIN students t ON t.school_id = c.school_id AND t.id = s.student_id
    JOIN guardian_student_links l ON l.school_id = c.school_id AND l.student_id = t.id
    JOIN guardians g ON g.school_id = c.school_id AND g.id = l.guardian_id AND g.has_access AND g.subject_id IS NOT NULL
    WHERE reminder.due_at > c.opened_at AND reminder.due_at <= ${now}
      AND (reminder.kind = 'mid' OR abs(extract(epoch FROM c.final_at - c.mid_at)) > 60)
    UNION ALL
    SELECT c.school_id, 'family_feedback.purge_reminder:' || c.id, m.subject_id, 'staff', m.id
    FROM retention c JOIN schools s ON s.id = c.school_id
    JOIN staff_members m ON m.school_id = s.id AND m.is_active AND m.account_kind = 'human' AND m.subject_id IS NOT NULL
    WHERE c.anchor > ${purgeBefore} AND c.anchor <= ${warnBefore}
      AND (m.subject_id = s.owner_subject_id OR EXISTS (
        SELECT 1 FROM staff_permission_assignments a WHERE a.school_id = s.id AND a.staff_id = m.id
          AND a.academic_year_id = c.academic_year_id AND a.permission = ${Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE}))
  )
  SELECT school_id FROM family_feedback_campaigns
  WHERE (status = 'scheduled' AND opens_at <= ${now} AND (closes_at IS NULL OR closes_at > ${now}))
     OR (status = 'open' AND closes_at <= ${now})
  UNION ALL SELECT school_id FROM retention WHERE anchor <= ${purgeBefore}
  UNION ALL SELECT r.school_id FROM recipients r WHERE ${missingDelivery}`
}

/** Select from the work tables before creating any school-bound journal records. */
export function dueSchoolQuery(jobKey: CronJobKey, asOf: Date): SQL {
  switch (jobKey) {
    case 'expireAccountInvitations':
      return sql`SELECT school_id FROM account_invitations WHERE status = 'pending' AND expires_at <= ${asOf.toISOString()}`
    case 'reconcilePendingDeliveries':
      return sql`SELECT school_id FROM message_deliveries WHERE status IN ('pending', 'sent')`
    case 'processDueNotifications':
      return notificationSchools(asOf)
    case 'advanceFamilyFeedbackCampaigns':
      return feedbackSchools(asOf)
    case 'preparePrivateFileCleanup':
      return sql`SELECT school_id FROM private_file_objects WHERE ${duePrivateFileObject}
        UNION ALL SELECT a.school_id FROM attachments a WHERE ${isAbandonedPortrait(asOf)}`
  }
}
