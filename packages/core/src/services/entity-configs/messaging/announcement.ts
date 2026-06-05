import type { Announcement } from '../../../entities/messaging/announcement'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const announcementConfig: EntityConfigFactory<Announcement> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.announcements,
    Permission.QUERY_COMMUNICATIONS_READ,
    Permission.COMMUNICATION_CREATE,
  )
  return {
    ...config,
    gates: {
      preDelete: validateAnnouncementDelete,
    },
  }
}

async function validateAnnouncementDelete(
  announcement: Announcement,
  repositories: SchoolRepositories,
): Promise<void> {
  const [targets, deliveries] = await Promise.all([
    repositories.announcementTargets.list({ announcementId: announcement.id }),
    repositories.messageDeliveries.list({ announcementId: announcement.id }),
  ])
  if (targets.length > 0 || deliveries.length > 0) {
    throw new BusinessRuleViolationError('ANNOUNCEMENT_HAS_DEPENDENCIES', `Cannot delete announcement ${announcement.id}: dependent records still exist`)
  }
}
