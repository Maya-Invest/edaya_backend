import type { EventNotificationTemplateEntry, InvitationNotificationTemplateEntry, SchoolNotificationTemplateCatalog } from '@edaya/core'
import {
  ACCOUNT_INVITATION_TEMPLATE_KEY,
  EVENT_NOTIFICATION_TEMPLATE_KEYS,

  schoolNotificationTemplateCatalogSchema,
} from '@edaya/core'
import { z } from 'zod'

export {
  type BaseMessageTemplate,
  baseMessageTemplateSchema,
  type EventNotificationTemplateEntry,
  eventNotificationTemplateEntrySchema,
  type InvitationNotificationTemplateEntry,
  invitationNotificationTemplateEntrySchema,
  type RichMessageTemplate,
  richMessageTemplateSchema,
  type SchoolNotificationTemplateCatalog,
  schoolNotificationTemplateCatalogSchema,
  type SchoolNotificationTemplateDocument,
  schoolNotificationTemplateDocumentSchema,
  type SimpleMessageTemplate,
  simpleMessageTemplateSchema,
} from '@edaya/core'

const baseMessagePatchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
}).partial()

const richMessagePatchSchema = z.object({
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
}).partial()

const simpleMessagePatchSchema = z.object({
  body: z.string().min(1).optional(),
}).partial()

const eventEntryPatchSchema = z.object({
  enable_email: z.boolean().optional(),
  enable_push: z.boolean().optional(),
  enable_sms: z.boolean().optional(),
  base_message: baseMessagePatchSchema.optional(),
  rich_message: richMessagePatchSchema.optional(),
  simple_message: simpleMessagePatchSchema.optional(),
}).partial()

const invitationEntryPatchSchema = z.object({
  rich_message: richMessagePatchSchema.optional(),
  simple_message: simpleMessagePatchSchema.optional(),
}).partial()

export const schoolNotificationTemplateDocumentPatchSchema = z.object({
  'invitationSmsEnabled': z.boolean().optional(),
  'announcement.published': eventEntryPatchSchema.optional(),
  'report_card.published': eventEntryPatchSchema.optional(),
  'attendance.recorded': eventEntryPatchSchema.optional(),
  'assessment.result_recorded': eventEntryPatchSchema.optional(),
  'incident.recorded': eventEntryPatchSchema.optional(),
  'assessment.due_soon': eventEntryPatchSchema.optional(),
  'activity.reminder': eventEntryPatchSchema.optional(),
  'calendar.event_reminder': eventEntryPatchSchema.optional(),
  'student_photo.approved': eventEntryPatchSchema.optional(),
  'student_photo.rejected': eventEntryPatchSchema.optional(),
  'family_feedback.opened': eventEntryPatchSchema.optional(),
  'family_feedback.reminder': eventEntryPatchSchema.optional(),
  'family_feedback.published': eventEntryPatchSchema.optional(),
  'family_feedback.purge_reminder': eventEntryPatchSchema.optional(),
  [ACCOUNT_INVITATION_TEMPLATE_KEY]: invitationEntryPatchSchema.optional(),
}).partial()

export type SchoolNotificationTemplateDocumentPatchInput = z.infer<
  typeof schoolNotificationTemplateDocumentPatchSchema
>

export function assertNotificationTemplateDocumentComplete(
  document: SchoolNotificationTemplateCatalog,
): void {
  schoolNotificationTemplateCatalogSchema.parse(document)
  for (const key of EVENT_NOTIFICATION_TEMPLATE_KEYS) {
    void key
  }
}

export interface EventNotificationTemplateEntryPatch {
  enable_email?: boolean
  enable_push?: boolean
  enable_sms?: boolean
  base_message?: Partial<EventNotificationTemplateEntry['base_message']>
  rich_message?: Partial<EventNotificationTemplateEntry['rich_message']>
  simple_message?: Partial<EventNotificationTemplateEntry['simple_message']>
}

export interface InvitationNotificationTemplateEntryPatch {
  rich_message?: Partial<InvitationNotificationTemplateEntry['rich_message']>
  simple_message?: Partial<InvitationNotificationTemplateEntry['simple_message']>
}
