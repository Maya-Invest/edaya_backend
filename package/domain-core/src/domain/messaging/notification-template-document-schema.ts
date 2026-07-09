import { z } from 'zod'

export const notificationChannelTemplateSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1, 'body must not be blank'),
})

export type NotificationChannelTemplate = z.infer<typeof notificationChannelTemplateSchema>

const dualChannelEntrySchema = z.object({
  email: notificationChannelTemplateSchema,
  in_app: notificationChannelTemplateSchema,
})

const emailOnlyEntrySchema = z.object({
  email: notificationChannelTemplateSchema,
})

const ACCOUNT_INVITATION_TEMPLATE_KEY = 'account_invitation' as const

export const schoolNotificationTemplateDocumentSchema = z.object({
  'announcement.published': dualChannelEntrySchema,
  'report_card.published': dualChannelEntrySchema,
  'attendance.recorded': dualChannelEntrySchema,
  'assessment.result_recorded': dualChannelEntrySchema,
  'incident.recorded': dualChannelEntrySchema,
  'assessment.due_soon': dualChannelEntrySchema,
  'activity.reminder': dualChannelEntrySchema,
  'calendar.event_reminder': dualChannelEntrySchema,
  [ACCOUNT_INVITATION_TEMPLATE_KEY]: emailOnlyEntrySchema,
})

export type SchoolNotificationTemplateDocument = z.infer<typeof schoolNotificationTemplateDocumentSchema>
