import type {
  EventNotificationTemplateEntry,
  EventNotificationTemplateKey,
  InvitationNotificationTemplateEntry,
  NotificationTemplateKey,
  SchoolNotificationTemplateCatalog,
} from '@edaya/core'
import type {
  EventNotificationTemplateEntryPatch,
  InvitationNotificationTemplateEntryPatch,
  SchoolNotificationTemplateDocumentPatchInput,
} from './document-schema'
import {
  ACCOUNT_INVITATION_TEMPLATE_KEY,
  EVENT_NOTIFICATION_TEMPLATE_KEYS,
  isEventNotificationTemplateKey,
  NOTIFICATION_TEMPLATE_FIELDS,
  schoolNotificationTemplateCatalogSchema,
} from '@edaya/core'

export type SchoolNotificationTemplateDocumentPatch = SchoolNotificationTemplateDocumentPatchInput

function mergeCopy<T extends Record<string, string>>(
  existing: T,
  patch: Partial<T> | undefined,
): T {
  if (!patch) {
    return existing
  }
  return { ...existing, ...patch }
}

function mergeEventEntry(
  existing: EventNotificationTemplateEntry,
  patch: EventNotificationTemplateEntryPatch,
): EventNotificationTemplateEntry {
  return {
    enable_email: patch.enable_email ?? existing.enable_email,
    enable_push: patch.enable_push ?? existing.enable_push,
    enable_sms: patch.enable_sms ?? existing.enable_sms,
    base_message: mergeCopy(existing.base_message, patch.base_message),
    rich_message: mergeCopy(existing.rich_message, patch.rich_message),
    simple_message: mergeCopy(existing.simple_message, patch.simple_message),
  }
}

function mergeInvitationEntry(
  existing: InvitationNotificationTemplateEntry,
  patch: InvitationNotificationTemplateEntryPatch,
): InvitationNotificationTemplateEntry {
  return {
    rich_message: mergeCopy(existing.rich_message, patch.rich_message),
    simple_message: mergeCopy(existing.simple_message, patch.simple_message),
  }
}

export function mergeSchoolNotificationTemplateDocument(
  existing: SchoolNotificationTemplateCatalog,
  patch: SchoolNotificationTemplateDocumentPatch,
): SchoolNotificationTemplateCatalog {
  const overlay: Partial<SchoolNotificationTemplateCatalog> = {
    invitationSmsEnabled: patch.invitationSmsEnabled,
  }

  for (const key of EVENT_NOTIFICATION_TEMPLATE_KEYS) {
    const entryPatch = patch[key]
    if (!entryPatch) {
      continue
    }
    const field = NOTIFICATION_TEMPLATE_FIELDS[key]
    overlay[field] = mergeEventEntry(existing[field] as EventNotificationTemplateEntry, entryPatch)
  }

  const invitationPatch = patch[ACCOUNT_INVITATION_TEMPLATE_KEY]
  if (invitationPatch) {
    overlay.accountInvitation = mergeInvitationEntry(existing.accountInvitation, invitationPatch)
  }

  return mergeNotificationTemplateCatalogs(existing, overlay)
}

export function mergeNotificationTemplateCatalogs(
  base: SchoolNotificationTemplateCatalog,
  overlay: Partial<SchoolNotificationTemplateCatalog>,
): SchoolNotificationTemplateCatalog {
  const merged: SchoolNotificationTemplateCatalog = {
    ...base,
    invitationSmsEnabled: overlay.invitationSmsEnabled ?? base.invitationSmsEnabled,
  }

  for (const key of EVENT_NOTIFICATION_TEMPLATE_KEYS) {
    const field = NOTIFICATION_TEMPLATE_FIELDS[key]
    const overlayEntry = overlay[field]
    if (overlayEntry) {
      merged[field] = overlayEntry
    }
  }

  if (overlay.accountInvitation) {
    merged.accountInvitation = overlay.accountInvitation
  }

  return schoolNotificationTemplateCatalogSchema.parse(merged)
}

export function replaceNotificationTemplateKey(
  existing: SchoolNotificationTemplateCatalog,
  key: NotificationTemplateKey,
  entry: EventNotificationTemplateEntry | InvitationNotificationTemplateEntry,
): SchoolNotificationTemplateCatalog {
  const field = NOTIFICATION_TEMPLATE_FIELDS[key]
  if (isEventNotificationTemplateKey(key)) {
    return schoolNotificationTemplateCatalogSchema.parse({
      ...existing,
      [field]: entry,
    })
  }
  return schoolNotificationTemplateCatalogSchema.parse({
    ...existing,
    accountInvitation: entry,
  })
}

export function catalogFieldForKey(
  key: EventNotificationTemplateKey | typeof ACCOUNT_INVITATION_TEMPLATE_KEY,
): typeof NOTIFICATION_TEMPLATE_FIELDS[typeof key] {
  return NOTIFICATION_TEMPLATE_FIELDS[key]
}
