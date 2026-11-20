import type { SchoolRepositories } from '../../../ports/school-repositories'
import { SchoolNotificationTemplates } from '@edaya/core'
import { buildDefaultNotificationTemplateDocument } from './defaults/manifest'
import { mergeNotificationTemplateCatalogs } from './merge-school-notification-templates'

export async function seedSchoolNotificationTemplates(
  repositories: Pick<SchoolRepositories, 'schoolNotificationTemplates'>,
  schoolId: string,
): Promise<void> {
  const defaults = await buildDefaultNotificationTemplateDocument()
  const existing = await repositories.schoolNotificationTemplates.findById(schoolId)
  if (existing) {
    const merged = mergeNotificationTemplateCatalogs(defaults, existing.catalog)
    if (JSON.stringify(merged) === JSON.stringify(existing.catalog)) {
      return
    }

    const now = new Date()
    await repositories.schoolNotificationTemplates.save(existing.copyWith({
      ...merged,
      updatedAt: now,
    }))
    return
  }

  const now = new Date()
  await repositories.schoolNotificationTemplates.save(new SchoolNotificationTemplates({
    schoolId,
    ...defaults,
    createdAt: now,
    updatedAt: now,
  }))
}
