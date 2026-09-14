import type { EventNotificationTemplateKey, NotificationTemplateKey } from './notification-template-keys'
import { z } from 'zod'
import {
  ACCOUNT_INVITATION_TEMPLATE_KEY,
  EVENT_NOTIFICATION_TEMPLATE_KEYS,
  NOTIFICATION_TEMPLATE_FIELDS,
} from './notification-template-keys'

export const baseMessageTemplateSchema = z.object({
  title: z.string().min(1, 'title must not be blank'),
  body: z.string().min(1, 'body must not be blank'),
})

export const richMessageTemplateSchema = z.object({
  subject: z.string().min(1, 'subject must not be blank'),
  body: z.string().min(1, 'body must not be blank'),
})

export const simpleMessageTemplateSchema = z.object({
  body: z.string().min(1, 'body must not be blank'),
})

export const eventNotificationTemplateEntrySchema = z.object({
  enable_email: z.boolean().default(true),
  enable_push: z.boolean().default(true),
  enable_sms: z.boolean().default(false),
  base_message: baseMessageTemplateSchema,
  rich_message: richMessageTemplateSchema,
  simple_message: simpleMessageTemplateSchema,
})

export const invitationNotificationTemplateEntrySchema = z.object({
  rich_message: richMessageTemplateSchema,
  simple_message: simpleMessageTemplateSchema,
})

export type BaseMessageTemplate = z.infer<typeof baseMessageTemplateSchema>
export type RichMessageTemplate = z.infer<typeof richMessageTemplateSchema>
export type SimpleMessageTemplate = z.infer<typeof simpleMessageTemplateSchema>
export type EventNotificationTemplateEntry = z.infer<typeof eventNotificationTemplateEntrySchema>
export type InvitationNotificationTemplateEntry = z.infer<typeof invitationNotificationTemplateEntrySchema>

export const schoolNotificationTemplateCatalogSchema = z.object({
  invitationSmsEnabled: z.boolean().default(false),
  announcementPublished: eventNotificationTemplateEntrySchema,
  reportCardPublished: eventNotificationTemplateEntrySchema,
  attendanceRecorded: eventNotificationTemplateEntrySchema,
  assessmentResultRecorded: eventNotificationTemplateEntrySchema,
  incidentRecorded: eventNotificationTemplateEntrySchema,
  assessmentDueSoon: eventNotificationTemplateEntrySchema,
  activityReminder: eventNotificationTemplateEntrySchema,
  calendarEventReminder: eventNotificationTemplateEntrySchema,
  accountInvitation: invitationNotificationTemplateEntrySchema,
})

export type SchoolNotificationTemplateCatalog = z.infer<typeof schoolNotificationTemplateCatalogSchema>
export type SchoolNotificationTemplateCatalogInput = z.input<typeof schoolNotificationTemplateCatalogSchema>

/** @deprecated Use SchoolNotificationTemplateCatalog. Kept as an alias for merge/defaults call sites. */
export const schoolNotificationTemplateDocumentSchema = schoolNotificationTemplateCatalogSchema
export type SchoolNotificationTemplateDocument = SchoolNotificationTemplateCatalog

export function notificationTemplateField(
  key: NotificationTemplateKey,
): typeof NOTIFICATION_TEMPLATE_FIELDS[NotificationTemplateKey] {
  return NOTIFICATION_TEMPLATE_FIELDS[key]
}

export function readEventNotificationTemplate(
  catalog: SchoolNotificationTemplateCatalog,
  key: EventNotificationTemplateKey,
): EventNotificationTemplateEntry {
  return catalog[NOTIFICATION_TEMPLATE_FIELDS[key]] as EventNotificationTemplateEntry
}

export function readInvitationNotificationTemplate(
  catalog: SchoolNotificationTemplateCatalog,
): InvitationNotificationTemplateEntry {
  return catalog[NOTIFICATION_TEMPLATE_FIELDS[ACCOUNT_INVITATION_TEMPLATE_KEY]]
}

export function isEventNotificationTemplateKey(
  key: NotificationTemplateKey,
): key is EventNotificationTemplateKey {
  return (EVENT_NOTIFICATION_TEMPLATE_KEYS as readonly string[]).includes(key)
}
