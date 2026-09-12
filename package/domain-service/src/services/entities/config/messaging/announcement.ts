import { Permission } from '@edaya/core';
import type { Announcement } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';

import { BusinessRuleViolationError } from '@edaya/core';
import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/messaging/announcement.ts (PR3)
export const announcementConfig: EntityConfigFactory<Announcement> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.announcements,
    tenant: directSchoolTenant(),
    authorization: { resource: 'announcements', read: [Permission.QUERY_COMMUNICATIONS_READ], write: [Permission.COMMUNICATION_CREATE] },
    
    gates: {
      preDelete: validateAnnouncementDelete,
    },
    atomicExecution,
  })

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
