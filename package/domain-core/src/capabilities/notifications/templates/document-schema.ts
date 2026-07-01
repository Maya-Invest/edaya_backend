import { z } from 'zod'
import { ACCOUNT_INVITATION_TEMPLATE_KEY, NOTIFICATION_TEMPLATE_KEYS } from './keys'

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

export const schoolNotificationTemplateDocumentSchema = z.object({
  'announcement.published': dualChannelEntrySchema,
  'report_card.published': dualChannelEntrySchema,
  'attendance.recorded': dualChannelEntrySchema,
  'assessment.result_recorded': dualChannelEntrySchema,
  'incident.recorded': dualChannelEntrySchema,
  'assessment.due_soon': dualChannelEntrySchema,
  'homework.due_soon': dualChannelEntrySchema,
  'activity.reminder': dualChannelEntrySchema,
  'calendar.event_reminder': dualChannelEntrySchema,
  [ACCOUNT_INVITATION_TEMPLATE_KEY]: emailOnlyEntrySchema,
})

export type SchoolNotificationTemplateDocument = z.infer<typeof schoolNotificationTemplateDocumentSchema>

const emailOnlyEntryPatchSchema = z.object({
  email: notificationChannelTemplateSchema.partial().optional(),
}).partial()

const dualChannelEntryPatchSchema = z.object({
  email: notificationChannelTemplateSchema.partial().optional(),
  in_app: notificationChannelTemplateSchema.partial().optional(),
}).partial()

export const schoolNotificationTemplateDocumentPatchSchema = z.object({
  'announcement.published': dualChannelEntryPatchSchema.optional(),
  'report_card.published': dualChannelEntryPatchSchema.optional(),
  'attendance.recorded': dualChannelEntryPatchSchema.optional(),
  'assessment.result_recorded': dualChannelEntryPatchSchema.optional(),
  'incident.recorded': dualChannelEntryPatchSchema.optional(),
  'assessment.due_soon': dualChannelEntryPatchSchema.optional(),
  'homework.due_soon': dualChannelEntryPatchSchema.optional(),
  'activity.reminder': dualChannelEntryPatchSchema.optional(),
  'calendar.event_reminder': dualChannelEntryPatchSchema.optional(),
  [ACCOUNT_INVITATION_TEMPLATE_KEY]: emailOnlyEntryPatchSchema.optional(),
}).partial()

export type SchoolNotificationTemplateDocumentPatchInput = z.infer<
  typeof schoolNotificationTemplateDocumentPatchSchema
>

export function assertNotificationTemplateDocumentComplete(
  document: SchoolNotificationTemplateDocument,
): void {
  schoolNotificationTemplateDocumentSchema.parse(document)
  for (const key of NOTIFICATION_TEMPLATE_KEYS) {
    if (!(key in document)) {
      throw new Error(`Missing notification template key: ${key}`)
    }
  }
}
