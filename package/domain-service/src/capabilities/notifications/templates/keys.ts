/** Notification template keys — keep in sync with provider workflow/bootstrap catalogs. */
export const NOTIFICATION_TEMPLATE_KEYS = [
  'announcement.published',
  'report_card.published',
  'attendance.recorded',
  'assessment.result_recorded',
  'incident.recorded',
  'assessment.due_soon',
  'activity.reminder',
  'calendar.event_reminder',
  'account_invitation',
] as const

export type NotificationTemplateKey = typeof NOTIFICATION_TEMPLATE_KEYS[number]

export type NotificationChannel = 'email' | 'in_app'

export const ACCOUNT_INVITATION_TEMPLATE_KEY = 'account_invitation' as const satisfies NotificationTemplateKey
