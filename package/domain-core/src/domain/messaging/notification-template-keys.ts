export const EVENT_NOTIFICATION_TEMPLATE_KEYS = [
  'announcement.published',
  'report_card.published',
  'attendance.recorded',
  'assessment.result_recorded',
  'incident.recorded',
  'assessment.due_soon',
  'activity.reminder',
  'calendar.event_reminder',
  'student_photo.approved',
  'student_photo.rejected',
] as const

export const ACCOUNT_INVITATION_TEMPLATE_KEY = 'account_invitation' as const

export const NOTIFICATION_TEMPLATE_KEYS = [
  ...EVENT_NOTIFICATION_TEMPLATE_KEYS,
  ACCOUNT_INVITATION_TEMPLATE_KEY,
] as const

export type EventNotificationTemplateKey = typeof EVENT_NOTIFICATION_TEMPLATE_KEYS[number]
export type NotificationTemplateKey = typeof NOTIFICATION_TEMPLATE_KEYS[number]

export const NOTIFICATION_TEMPLATE_FIELDS = {
  'announcement.published': 'announcementPublished',
  'report_card.published': 'reportCardPublished',
  'attendance.recorded': 'attendanceRecorded',
  'assessment.result_recorded': 'assessmentResultRecorded',
  'incident.recorded': 'incidentRecorded',
  'assessment.due_soon': 'assessmentDueSoon',
  'activity.reminder': 'activityReminder',
  'calendar.event_reminder': 'calendarEventReminder',
  'student_photo.approved': 'studentPhotoApproved',
  'student_photo.rejected': 'studentPhotoRejected',
  'account_invitation': 'accountInvitation',
} as const satisfies Record<NotificationTemplateKey, string>

export type NotificationTemplateField = typeof NOTIFICATION_TEMPLATE_FIELDS[NotificationTemplateKey]

export const NOTIFICATION_TEMPLATE_SQL_COLUMNS = {
  'announcement.published': 'announcement_published',
  'report_card.published': 'report_card_published',
  'attendance.recorded': 'attendance_recorded',
  'assessment.result_recorded': 'assessment_result_recorded',
  'incident.recorded': 'incident_recorded',
  'assessment.due_soon': 'assessment_due_soon',
  'activity.reminder': 'activity_reminder',
  'calendar.event_reminder': 'calendar_event_reminder',
  'student_photo.approved': 'student_photo_approved',
  'student_photo.rejected': 'student_photo_rejected',
  'account_invitation': 'account_invitation',
} as const satisfies Record<NotificationTemplateKey, string>
