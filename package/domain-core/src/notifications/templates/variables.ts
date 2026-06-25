import type { NotificationTemplateKey } from './keys'

/** Allowed placeholder names per template key (documentation + future validation). */
export const NOTIFICATION_TEMPLATE_VARIABLES = {
  'announcement.published': ['schoolName', 'announcementTitle', 'announcementBody'],
  'report_card.published': ['schoolName', 'studentName'],
  'attendance.recorded': ['schoolName', 'studentName', 'status', 'sessionTitle'],
  'assessment.result_recorded': ['schoolName', 'assessmentTitle'],
  'incident.recorded': ['schoolName', 'incidentTitle', 'incidentDescription'],
  'assessment.due_soon': ['schoolName', 'assessmentTitle', 'dueDate'],
  'homework.due_soon': ['schoolName', 'homeworkTitle', 'dueDate'],
  'activity.reminder': ['schoolName', 'activityName', 'startDate'],
  'calendar.event_reminder': ['schoolName', 'eventTitle', 'startDate'],
  'account_invitation': ['schoolName', 'inviteeName', 'inviteUrl', 'expiresAt', 'actorKind'],
} as const satisfies Record<NotificationTemplateKey, readonly string[]>
