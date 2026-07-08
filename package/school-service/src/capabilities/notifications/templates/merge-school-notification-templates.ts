import type { NotificationChannelTemplate, SchoolNotificationTemplateDocument } from './document-schema'
import type { NotificationTemplateKey } from './keys'
import { schoolNotificationTemplateDocumentSchema } from './document-schema'
import { NOTIFICATION_TEMPLATE_KEYS } from './keys'

export type NotificationChannelTemplatePatch = Partial<NotificationChannelTemplate>

export interface NotificationTemplateEntryPatch {
  email?: NotificationChannelTemplatePatch
  in_app?: NotificationChannelTemplatePatch
}

export type SchoolNotificationTemplateDocumentPatch = Partial<
  Record<NotificationTemplateKey, NotificationTemplateEntryPatch>
>

function mergeChannelTemplate(
  existing: NotificationChannelTemplate | undefined,
  patch: NotificationChannelTemplatePatch | undefined,
): NotificationChannelTemplate | undefined {
  if (!patch) {
    return existing
  }
  if (!existing) {
    if (!patch.body) {
      return undefined
    }
    return {
      subject: patch.subject,
      body: patch.body,
    }
  }
  return {
    subject: patch.subject ?? existing.subject,
    body: patch.body ?? existing.body,
  }
}

function mergeTemplateEntry<K extends NotificationTemplateKey>(
  _key: K,
  existing: SchoolNotificationTemplateDocument[K],
  patch: NotificationTemplateEntryPatch,
): SchoolNotificationTemplateDocument[K] {
  const merged = {
    ...(existing.email || patch.email
      ? { email: mergeChannelTemplate(existing.email, patch.email) }
      : {}),
    ...(('in_app' in existing || patch.in_app)
      ? { in_app: mergeChannelTemplate(
          'in_app' in existing ? existing.in_app : undefined,
          patch.in_app,
        ) }
      : {}),
  }

  return merged as SchoolNotificationTemplateDocument[K]
}

export function mergeSchoolNotificationTemplateDocument(
  existing: SchoolNotificationTemplateDocument,
  patch: SchoolNotificationTemplateDocumentPatch,
): SchoolNotificationTemplateDocument {
  const merged = { ...existing }

  for (const key of NOTIFICATION_TEMPLATE_KEYS) {
    const entryPatch = patch[key]
    if (!entryPatch) {
      continue
    }
    Object.assign(merged, {
      [key]: mergeTemplateEntry(key, existing[key], entryPatch),
    })
  }

  return schoolNotificationTemplateDocumentSchema.parse(merged)
}
