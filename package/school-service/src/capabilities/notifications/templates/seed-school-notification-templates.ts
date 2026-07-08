import type { SchoolRepositories } from '@edaya/school-service'
import { SchoolNotificationTemplates } from '@edaya/core'
import { buildDefaultNotificationTemplateDocument } from './defaults/manifest'
import { NOTIFICATION_TEMPLATE_KEYS } from './keys'
import { mergeSchoolNotificationTemplateDocument } from './merge-school-notification-templates'

function isMissingTemplateKeys(
  templates: SchoolNotificationTemplates['templates'],
): boolean {
  return NOTIFICATION_TEMPLATE_KEYS.some(key => !(key in templates))
}

export async function seedSchoolNotificationTemplates(
  repositories: Pick<SchoolRepositories, 'schoolNotificationTemplates'>,
  schoolId: string,
): Promise<void> {
  const defaults = await buildDefaultNotificationTemplateDocument()
  const existing = await repositories.schoolNotificationTemplates.findById(schoolId)
  if (existing) {
    if (!isMissingTemplateKeys(existing.templates)) {
      return
    }

    const now = new Date()
    await repositories.schoolNotificationTemplates.save(new SchoolNotificationTemplates({
      schoolId,
      templates: mergeSchoolNotificationTemplateDocument(defaults, existing.templates),
      createdAt: existing.createdAt,
      updatedAt: now,
    }))
    return
  }

  const now = new Date()
  await repositories.schoolNotificationTemplates.save(new SchoolNotificationTemplates({
    schoolId,
    templates: defaults,
    createdAt: now,
    updatedAt: now,
  }))
}
