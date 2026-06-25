import type { SchoolRepositories } from '../../ports'
import { SchoolNotificationTemplates } from '../../domains/messaging/school-notification-templates'
import { buildDefaultNotificationTemplateDocument } from './defaults/manifest'
import { mergeSchoolNotificationTemplateDocument } from './merge-school-notification-templates'
import { NOTIFICATION_TEMPLATE_KEYS } from './keys'

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
