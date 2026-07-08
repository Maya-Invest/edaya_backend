import type { SchoolNotificationTemplateDocument } from '@edaya/core'
import {
  notificationChannelTemplateSchema,

  schoolNotificationTemplateDocumentSchema,
} from '@edaya/core'
import { z } from 'zod'
import { ACCOUNT_INVITATION_TEMPLATE_KEY, NOTIFICATION_TEMPLATE_KEYS } from './keys'

export {
  type NotificationChannelTemplate,
  notificationChannelTemplateSchema,
  type SchoolNotificationTemplateDocument,
  schoolNotificationTemplateDocumentSchema,
} from '@edaya/core'

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
